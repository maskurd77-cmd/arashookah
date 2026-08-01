import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, addDoc, serverTimestamp, query, orderBy, onSnapshot, increment, getDocs, getDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Scale, Plus, History, Search, FlaskConical, Trash2, CheckCircle2, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function WeighedItems() {
  const { setShowFirebaseSetup } = useAuth();
  
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [mixHistory, setMixHistory] = useState<any[]>([]);
  const [addHistory, setAddHistory] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [addAmount, setAddAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');

  const [activeTab, setActiveTab] = useState<'stock' | 'recipes' | 'mix_history' | 'history'>('stock');

  const [companies, setCompanies] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['دەرمان', 'نێرگلە', 'شیشە', 'یاریەکان', 'فەحم', 'هیتەر']);

  // Mix Modals
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    name: '',
    targetProductId: '',
    targetAmount: 1,
    ingredients: [] as { productId: string, productName: string, quantity: number, category?: string, company?: string }[]
  });

  const [isMixModalOpen, setIsMixModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [mixAmount, setMixAmount] = useState<number>(1);

  useEffect(() => {
    const fetchCompaniesAndCategories = async () => {
      try {
        const companiesSnap = await getDocs(collection(db, 'companies'));
        setCompanies(companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const catRef = doc(db, 'settings', 'categories');
        const catSnap = await getDoc(catRef);
        if (catSnap.exists() && catSnap.data().items) {
          setCategories(catSnap.data().items);
        }
      } catch (error) {
        console.error("Error fetching companies and categories", error);
      }
    };
    fetchCompaniesAndCategories();
  }, []);

  useEffect(() => {
    // Fetch all products
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllProducts(productsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      if (error.code === 'failed-precondition' || error.message.includes('permission')) {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setShowFirebaseSetup]);

  useEffect(() => {
    // Fetch recipes
    const q = query(collection(db, 'mix_recipes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecipes(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch mix history
    const q = query(collection(db, 'mix_history'), orderBy('date', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMixHistory(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch general history
    const q = query(collection(db, 'inventoryHistory'), orderBy('date', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAddHistory(data);
    });
    return () => unsubscribe();
  }, []);

  const weighedProducts = allProducts.filter(p => p.isWeighed);
  const regularProducts = allProducts.filter(p => !p.isWeighed); // Using non-weighed for ingredients

  const filteredHistory = addHistory.filter((h: any) => {
    const weighedNames = weighedProducts.map(p => p.name);
    return weighedNames.includes(h.productName);
  });

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !addAmount || addAmount <= 0) return;

    try {
      const productRef = doc(db, 'products', selectedProduct.id);
      const newStock = (selectedProduct.stock || 0) + Number(addAmount);
      
      await updateDoc(productRef, {
        stock: newStock
      });

      await addDoc(collection(db, 'inventoryHistory'), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: 'add',
        amount: Number(addAmount),
        previousStock: selectedProduct.stock || 0,
        newStock: newStock,
        date: serverTimestamp(),
        note: note || 'زیادکردنی کیلۆ بۆ کاڵا بە دەستی',
        isWeighed: true
      });

      setIsAddModalOpen(false);
      setSelectedProduct(null);
      setAddAmount('');
      setNote('');
    } catch (error) {
      console.error('Error adding stock:', error);
      alert('هەڵەیەک ڕوویدا لە کاتی زیادکردنی کێش');
    }
  };

  // Recipe Functions
  const handleAddIngredient = () => {
    setRecipeForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { productId: '', productName: '', quantity: 1, category: '', company: '' }]
    }));
  };

  const handleIngredientChange = (index: number, field: string, value: any) => {
    const newIngredients = [...recipeForm.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    if (field === 'productId') {
      const prod = allProducts.find(p => p.id === value);
      if (prod) newIngredients[index].productName = prod.name;
    }
    setRecipeForm(prev => ({ ...prev, ingredients: newIngredients }));
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeForm.name || !recipeForm.targetProductId || recipeForm.ingredients.length === 0) return;
    try {
      await addDoc(collection(db, 'mix_recipes'), {
        ...recipeForm,
        createdAt: serverTimestamp()
      });
      setIsRecipeModalOpen(false);
      setRecipeForm({ name: '', targetProductId: '', targetAmount: 1, ingredients: [] });
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا');
    }
  };

  // Make Mix Function
  const handleMakeMix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipe || !mixAmount || mixAmount <= 0) return;

    try {
      const multiplier = mixAmount / selectedRecipe.targetAmount;
      const calculatedIngredients = selectedRecipe.ingredients.map((ing: any) => ({
        ...ing,
        calculatedQuantity: ing.quantity * multiplier
      }));

      // Update all ingredient stocks
      for (const ing of calculatedIngredients) {
        const productRef = doc(db, 'products', ing.productId);
        await updateDoc(productRef, {
          stock: increment(-ing.calculatedQuantity)
        });
      }

      // Update target product stock
      const targetRef = doc(db, 'products', selectedRecipe.targetProductId);
      await updateDoc(targetRef, {
        stock: increment(mixAmount)
      });

      // Add to mix history
      await addDoc(collection(db, 'mix_history'), {
        recipeId: selectedRecipe.id,
        recipeName: selectedRecipe.name,
        targetProductId: selectedRecipe.targetProductId,
        targetProductName: allProducts.find(p => p.id === selectedRecipe.targetProductId)?.name || 'نەناسراو',
        amountProduced: mixAmount,
        ingredientsUsed: calculatedIngredients,
        date: serverTimestamp()
      });

      setIsMixModalOpen(false);
      setSelectedRecipe(null);
      setMixAmount(1);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی دروستکردنی خەلتە');
    }
  };

  const filteredProducts = weighedProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <FlaskConical className="text-amber-500" size={32} />
            خەلتە و کێشانە
          </h1>
          <p className="text-gray-500 mt-1 font-medium">بەڕێوەبردنی خەلتەکان و تێکەڵکردنی پێکهاتەکان بۆ دروستکردنی کاڵای نوێ</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'stock' 
                ? 'bg-white text-amber-700 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
          >
            کۆگای کێشانە
          </button>
          <button
            onClick={() => setActiveTab('recipes')}
            className={`px-4 py-2.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'recipes' 
                ? 'bg-white text-amber-700 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
          >
            ڕەچەتەکان (خەلتە)
          </button>
          <button
            onClick={() => setActiveTab('mix_history')}
            className={`px-4 py-2.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'mix_history' 
                ? 'bg-white text-amber-700 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
          >
            مێژووی خەلتەکان
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'history' 
                ? 'bg-white text-amber-700 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
          >
            مێژووی زیادکردن (دەستی)
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'stock' && (
          <>
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
              <div className="relative w-full sm:w-96">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="گەڕان بەدوای کاڵا..."
                  className="w-full pl-4 pr-12 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 transition-all font-medium text-gray-700 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">ناوی کاڵا</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">کێشی بەردەست</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">نرخی کیلۆ</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">کردارەکان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500 font-medium">
                        بارکردن...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        <Scale size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="font-medium text-lg text-gray-600">هیچ کاڵایەک نەدۆزرایەوە کە بە کێش بفرۆشرێت</p>
                        <p className="text-sm mt-1">بۆ زیادکردنی کاڵای نوێ، بڕۆ بۆ بەشی کاڵاکان</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(product => (
                      <tr key={product.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 text-lg">{product.name}</div>
                          <div className="text-sm text-gray-500 font-medium">{product.category} {product.company ? `- ${product.company}` : ''}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
                            product.stock <= 0 ? 'bg-red-50 text-red-700 border border-red-100' :
                            product.stock <= 2 ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            <Scale size={16} />
                            {product.stock?.toFixed(3) || 0} کگم
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg">
                            {product.price?.toLocaleString()} IQD
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setIsAddModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl font-bold hover:bg-amber-100 hover:text-amber-800 transition-colors border border-amber-200/50"
                          >
                            <Plus size={18} />
                            زیادکردن (دەستی)
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'recipes' && (
          <div className="bg-white">
            <div className="p-6 flex justify-between items-center bg-gray-50/50 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-800">ڕەچەتەکانی خەلتە</h2>
                <p className="text-sm text-gray-500 mt-1">لێرە دەتوانیت پێکهاتەی خەلتەکان دیاری بکەیت</p>
              </div>
              <button 
                onClick={() => setIsRecipeModalOpen(true)} 
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-sm"
              >
                <Plus size={18} />
                ڕەچەتەی نوێ
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {recipes.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-500">
                  <FlaskConical size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="font-medium text-lg text-gray-600">هیچ ڕەچەتەیەک بوونی نییە</p>
                  <p className="text-sm mt-1">تکایە ڕەچەتەیەکی نوێ دروست بکە بۆ دەستپێکردن</p>
                </div>
              ) : (
                recipes.map(recipe => (
                  <div key={recipe.id} className="border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{recipe.name}</h3>
                    <p className="text-gray-500 text-sm mb-4">بۆ بەرهەمهێنانی {recipe.targetAmount} کگم <span className="font-bold text-amber-600">{allProducts.find(p => p.id === recipe.targetProductId)?.name}</span></p>
                    
                    <div className="space-y-2 mb-6 bg-gray-50 border border-gray-100 p-4 rounded-xl flex-1">
                      <h4 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-3">پێکهاتەکان</h4>
                      {recipe.ingredients.map((ing: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm font-medium text-gray-700 border-b border-gray-100/50 pb-2 last:border-0 last:pb-0">
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            {ing.productName}
                          </span>
                          <span className="text-gray-500 font-bold">{ing.quantity} دانە</span>
                        </div>
                      ))}
                    </div>
                    
                    <button 
                      onClick={() => { setSelectedRecipe(recipe); setMixAmount(recipe.targetAmount); setIsMixModalOpen(true); }}
                      className="w-full flex justify-center items-center gap-2 py-3 bg-amber-50 text-amber-700 rounded-xl font-bold hover:bg-amber-100 transition-colors border border-amber-200/50"
                    >
                      <CheckCircle2 size={18} />
                      دروستکردنی خەلتە (تێکەڵکردن)
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'mix_history' && (
          <div className="overflow-x-auto">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">مێژووی دروستکردنی خەلتەکان</h2>
              <p className="text-sm text-gray-500 mt-1">ئەو خەلتانەی کە دروستکراون و کاڵاکانیان لە کۆگا کەمکراوەتەوە</p>
            </div>
            <table className="w-full text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">ناوی خەلتە</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">بڕی دروستکراو</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">پێکهاتە بەکارهاتووەکان</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">بەروار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mixHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      <History size={48} className="mx-auto mb-4 text-gray-300" />
                      <p className="font-medium text-lg text-gray-600">هیچ تۆمارێک نییە</p>
                    </td>
                  </tr>
                ) : (
                  mixHistory.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900 text-lg">{item.targetProductName}</span>
                        <span className="text-sm font-medium text-amber-600 block mt-1">{item.recipeName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-amber-50 text-amber-700 border border-amber-100">
                          + {item.amountProduced} کگم
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {item.ingredientsUsed.map((ing: any, idx: number) => (
                            <span key={idx} className="text-xs font-bold text-gray-700 bg-white border border-gray-200 shadow-sm px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                              {ing.productName}: <span className="text-red-500">-{ing.calculatedQuantity}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm font-medium">
                        {item.date?.toDate ? format(item.date.toDate(), 'yyyy/MM/dd HH:mm') : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="overflow-x-auto">
             <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">مێژووی زیادکردنی دەستی</h2>
              <p className="text-sm text-gray-500 mt-1">کێشی کاڵاکان کە بە دەستی زیادکراون بێ بەکارهێنانی ڕەچەتە</p>
            </div>
            <table className="w-full text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">کاڵا</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">کێشی زیادکراو</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">کێشی پێشوو</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">کێشی نوێ</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">بەروار</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">تێبینی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <History size={48} className="mx-auto mb-4 text-gray-300" />
                      <p className="font-medium text-lg text-gray-600">هیچ تۆمارێک نییە</p>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{item.productName}</td>
                      <td className="px-6 py-4 font-bold text-emerald-600">+{item.amount} کگم</td>
                      <td className="px-6 py-4 text-gray-500 font-medium">{item.previousStock || 0}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{item.newStock}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm font-medium">
                        {item.date?.toDate ? format(item.date.toDate(), 'yyyy/MM/dd HH:mm') : ''}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{item.note}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Add Modal */}
      {isAddModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
              <Plus className="text-amber-500" size={28} />
              زیادکردنی کێش بە دەستی
            </h2>
            <p className="text-gray-500 mb-6 font-medium">بۆ کاڵای <span className="text-amber-600 font-bold">{selectedProduct.name}</span></p>
            
            <form onSubmit={handleAddStock} className="space-y-5">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100/50 mb-6 flex justify-between items-center">
                <span className="text-amber-800 font-bold">کێشی ئێستا:</span>
                <span className="text-xl font-black text-amber-600">{selectedProduct.stock?.toFixed(3) || 0} <span className="text-sm">کگم</span></span>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">بڕی زیادکراو (بە کیلۆگرام)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 transition-all font-bold text-lg text-left direction-ltr"
                    required
                  />
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">KG</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تێبینی (ئارەزوومەندانە)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                  placeholder="نموونە: هێنانی کاڵای نوێ..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-6 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={!addAmount || addAmount <= 0}
                  className="flex-[2] px-6 py-3.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  زیادکردن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Create Modal */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
              <FlaskConical className="text-amber-500" size={28} />
              دروستکردنی ڕەچەتەی نوێ
            </h2>
            <form onSubmit={handleSaveRecipe} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">ناوی ڕەچەتە</label>
                  <input 
                    type="text" 
                    value={recipeForm.name} 
                    onChange={(e) => setRecipeForm({...recipeForm, name: e.target.value})} 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 font-medium" 
                    placeholder="نموونە: خەلتەی تایبەت..."
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">ئامانج (کام خەلتەیە بەرهەم دێت؟)</label>
                  <select 
                    value={recipeForm.targetProductId} 
                    onChange={(e) => setRecipeForm({...recipeForm, targetProductId: e.target.value})} 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 font-medium" 
                    required
                  >
                    <option value="">هەڵبژێرە...</option>
                    {weighedProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ئەم ڕەچەتەیە بۆ چەند کیلۆگرامە؟ (بۆ نموونە: ١ کیلۆ)</label>
                <div className="relative max-w-xs">
                  <input 
                    type="number" 
                    step="0.001" 
                    value={recipeForm.targetAmount} 
                    onChange={(e) => setRecipeForm({...recipeForm, targetAmount: Number(e.target.value)})} 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold" 
                    required 
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">KG</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                    پێکهاتەکان
                    <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-md">{recipeForm.ingredients.length} دانە</span>
                  </h3>
                  <button 
                    type="button" 
                    onClick={handleAddIngredient} 
                    className="text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-4 py-2 rounded-xl transition-colors border border-amber-200/50 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    زیادکردنی پێکهاتە
                  </button>
                </div>
                
                {recipeForm.ingredients.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200 border-dashed mb-4">
                    <p className="text-gray-500 font-medium">هیچ پێکهاتەیەک زیاد نەکراوە بۆ ئەم ڕەچەتەیە</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    {recipeForm.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex flex-col gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div className="flex flex-col md:flex-row gap-3 items-end">
                          <div className="w-full md:w-1/4">
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">بەش (جۆر)</label>
                            <select 
                              value={ing.category || ''} 
                              onChange={(e) => handleIngredientChange(idx, 'category', e.target.value)} 
                              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium" 
                            >
                              <option value="">هەمووی</option>
                              {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className="w-full md:w-1/4">
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">شەریکە</label>
                            <select 
                              value={ing.company || ''} 
                              onChange={(e) => handleIngredientChange(idx, 'company', e.target.value)} 
                              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium" 
                            >
                              <option value="">هەمووی</option>
                              {companies.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                            </select>
                          </div>
                          <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">کاڵا (دەرمان)</label>
                            <select 
                              value={ing.productId} 
                              onChange={(e) => handleIngredientChange(idx, 'productId', e.target.value)} 
                              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium" 
                              required
                            >
                              <option value="">هەڵبژێرە...</option>
                              {regularProducts
                                .filter(p => (!ing.category || p.category === ing.category) && (!ing.company || p.company === ing.company))
                                .map(p => <option key={p.id} value={p.id}>{p.name} {p.company ? `- ${p.company}` : ''}</option>)}
                            </select>
                          </div>
                          <div className="w-full sm:w-24">
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">بڕ / دانە</label>
                            <input 
                              type="number" 
                              step="0.001" 
                              value={ing.quantity} 
                              onChange={(e) => handleIngredientChange(idx, 'quantity', Number(e.target.value))} 
                              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold" 
                              required 
                            />
                          </div>
                          <button 
                            type="button" 
                            onClick={() => {
                              const newIngs = [...recipeForm.ingredients];
                              newIngs.splice(idx, 1);
                              setRecipeForm({...recipeForm, ingredients: newIngs});
                            }} 
                            className="p-2.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors w-full sm:w-auto flex justify-center items-center h-[42px]"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsRecipeModalOpen(false)} className="flex-1 px-6 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors">پاشگەزبوونەوە</button>
                <button type="submit" disabled={recipeForm.ingredients.length === 0} className="flex-[2] px-6 py-3.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-sm disabled:opacity-50">پەسەندکردنی ڕەچەتە</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Make Mix Modal */}
      {isMixModalOpen && selectedRecipe && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
              <CheckCircle2 className="text-amber-500" size={28} />
              دروستکردنی خەلتە
            </h2>
            
            <div className="bg-gray-50 p-5 rounded-2xl mb-6 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ناوی ڕەچەتە</p>
              <p className="font-bold text-lg text-gray-900">{selectedRecipe.name}</p>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">بەرهەم دێت بۆ</p>
                <p className="text-sm text-amber-600 font-bold">{allProducts.find(p => p.id === selectedRecipe.targetProductId)?.name}</p>
              </div>
            </div>
            
            <form onSubmit={handleMakeMix} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">چەند کیلۆگرام دروست دەکەیت؟</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.001" 
                    value={mixAmount} 
                    onChange={(e) => setMixAmount(Number(e.target.value))} 
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xl text-left direction-ltr focus:ring-2 focus:ring-amber-500" 
                    required 
                  />
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">KG</span>
                </div>
              </div>

              <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100">
                <h4 className="font-bold text-sm text-amber-800 mb-4 flex items-center gap-2">
                  <Package size={16} />
                  پێویستییەکان لە کۆگا کەم دەبنەوە:
                </h4>
                <div className="space-y-3">
                  {selectedRecipe.ingredients.map((ing: any, idx: number) => {
                    const needed = (ing.quantity / selectedRecipe.targetAmount) * (mixAmount || 0);
                    const currentStock = allProducts.find(p => p.id === ing.productId)?.stock || 0;
                    const isShort = currentStock < needed;
                    return (
                      <div key={idx} className="flex justify-between items-center text-sm border-b border-amber-100/50 pb-2 last:border-0 last:pb-0">
                        <span className="font-medium text-gray-700">{ing.productName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">(هەیە: {currentStock})</span>
                          <span className={`font-bold px-2 py-1 rounded-md ${isShort ? 'bg-red-100 text-red-600' : 'bg-white text-amber-600 border border-amber-200'}`}>
                            -{needed.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {selectedRecipe.ingredients.some((ing: any) => {
                  const needed = (ing.quantity / selectedRecipe.targetAmount) * (mixAmount || 0);
                  const currentStock = allProducts.find(p => p.id === ing.productId)?.stock || 0;
                  return currentStock < needed;
                }) && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                    <Scale size={14} className="shrink-0" />
                    <span>ئاگاداربە! بڕی پێویست لە کۆگادا بەردەست نییە بۆ هەندێک لە پێکهاتەکان. هەرچەندە دەتوانیت بەردەوام بیت بەڵام ستۆک دەبێت بە قەرز (سالب).</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsMixModalOpen(false)} className="flex-1 px-6 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors">پاشگەزبوونەوە</button>
                <button type="submit" disabled={!mixAmount || mixAmount <= 0} className="flex-[2] px-6 py-3.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-sm disabled:opacity-50">تێکەڵکردن و خەزنکردن</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
