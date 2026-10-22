import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy, onSnapshot, increment, getDocs, getDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Scale, Plus, History, Search, FlaskConical, Trash2, CheckCircle2, Package, Edit2, Lock, ShieldCheck, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function WeighedItems() {
  const { setShowFirebaseSetup, userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [mixHistory, setMixHistory] = useState<any[]>([]);
  const [addHistory, setAddHistory] = useState<any[]>([]);

  // Admin recipe & mix edit/delete states
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<any | null>(null);
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false);
  const [mixToDelete, setMixToDelete] = useState<any | null>(null);
  const [isDeletingMix, setIsDeletingMix] = useState(false);
  const [editMixNoteItem, setEditMixNoteItem] = useState<any | null>(null);
  const [newMixNote, setNewMixNote] = useState('');
  
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

      // Atomic increment: a sale on another device at the same moment is not lost
      await updateDoc(productRef, {
        stock: increment(Number(addAmount))
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

  // Open Create Recipe
  const handleOpenCreateRecipe = () => {
    if (!isAdmin) {
      alert('تەنیا ئەدمین دەسەڵاتی دروستکردنی ڕەچەتەی هەیە!');
      return;
    }
    setEditingRecipeId(null);
    setRecipeForm({ name: '', targetProductId: '', targetAmount: 1, ingredients: [] });
    setIsRecipeModalOpen(true);
  };

  // Open Edit Recipe
  const handleOpenEditRecipe = (recipe: any) => {
    if (!isAdmin) {
      alert('تەنیا ئەدمین دەسەڵاتی دەستکاریکردنی ڕەچەتەی هەیە!');
      return;
    }
    setEditingRecipeId(recipe.id);
    setRecipeForm({
      name: recipe.name || '',
      targetProductId: recipe.targetProductId || '',
      targetAmount: recipe.targetAmount || 1,
      ingredients: recipe.ingredients || []
    });
    setIsRecipeModalOpen(true);
  };

  // Save (Create or Update) Recipe
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('تەنیا ئەدمین دەسەڵاتی هەیە!');
      return;
    }
    if (!recipeForm.name || !recipeForm.targetProductId || recipeForm.ingredients.length === 0) return;
    try {
      if (editingRecipeId) {
        await updateDoc(doc(db, 'mix_recipes', editingRecipeId), {
          ...recipeForm,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'mix_recipes'), {
          ...recipeForm,
          createdAt: serverTimestamp()
        });
      }
      setIsRecipeModalOpen(false);
      setEditingRecipeId(null);
      setRecipeForm({ name: '', targetProductId: '', targetAmount: 1, ingredients: [] });
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە پاشەکەوتکردنی ڕەچەتە');
    }
  };

  // Confirm Delete Recipe
  const handleConfirmDeleteRecipe = async () => {
    if (!isAdmin || !recipeToDelete) return;
    setIsDeletingRecipe(true);
    try {
      await deleteDoc(doc(db, 'mix_recipes', recipeToDelete.id));
      setRecipeToDelete(null);
    } catch (err: any) {
      console.error(err);
      alert('هەڵەیەک ڕوویدا لە سڕینەوەی ڕەچەتە: ' + err.message);
    } finally {
      setIsDeletingRecipe(false);
    }
  };

  // Confirm Delete & Revert Mix History
  const handleConfirmDeleteMixHistory = async () => {
    if (!isAdmin || !mixToDelete) return;
    setIsDeletingMix(true);
    try {
      // 1. Revert consumed ingredients back to products stock
      for (const ing of (mixToDelete.ingredientsUsed || [])) {
        if (ing.productId) {
          await updateDoc(doc(db, 'products', ing.productId), {
            stock: increment(ing.calculatedQuantity || 0)
          }).catch(console.error);
        }
      }
      // 2. Decrement the target produced product stock
      if (mixToDelete.targetProductId) {
        await updateDoc(doc(db, 'products', mixToDelete.targetProductId), {
          stock: increment(-(mixToDelete.amountProduced || 0))
        }).catch(console.error);
      }
      // 3. Delete the mix history document
      await deleteDoc(doc(db, 'mix_history', mixToDelete.id));
      setMixToDelete(null);
    } catch (err: any) {
      console.error(err);
      alert('هەڵەیەک ڕوویدا لە هەڵوەشاندنەوەی خەلتە: ' + err.message);
    } finally {
      setIsDeletingMix(false);
    }
  };

  // Delete & Revert Manual Add History
  const handleDeleteAddHistory = async (item: any) => {
    if (!isAdmin) {
      alert('تەنیا ئەدمین دەسەڵاتی سڕینەوەی ئەم تۆمارەی هەیە!');
      return;
    }
    if (!window.confirm(`دڵنیایت لە سڕینەوەی ئەم تۆمارە؟ بڕی (+${item.amount} کگم) لە کۆگای کاڵاکە کەم دەکرێتەوە.`)) return;
    try {
      if (item.productId) {
        await updateDoc(doc(db, 'products', item.productId), {
          stock: increment(-(item.amount || 0))
        }).catch(console.error);
      }
      await deleteDoc(doc(db, 'inventoryHistory', item.id));
    } catch (err: any) {
      alert('هەڵەیەک ڕوویدا: ' + err.message);
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
                <p className="text-sm text-gray-500 mt-1">لێرە دەتوانیت پێکهاتەی خەلتەکان دیاری بکەیت یان دەستکاری و بسڕیتەوە (تایبەت بە ئەدمین)</p>
              </div>
              <button 
                onClick={handleOpenCreateRecipe} 
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
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 pr-1">
                        <h3 className="text-lg font-bold text-gray-900 truncate">{recipe.name}</h3>
                        <p className="text-gray-500 text-xs mt-0.5">
                          بۆ بەرهەمهێنانی {recipe.targetAmount} کگم <span className="font-bold text-amber-600">{allProducts.find(p => p.id === recipe.targetProductId)?.name}</span>
                        </p>
                      </div>

                      {/* Admin Edit & Delete buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => handleOpenEditRecipe(recipe)}
                              className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200"
                              title="دەستکاریکردنی ڕەچەتە"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setRecipeToDelete(recipe)}
                              className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
                              title="سڕینەوەی ڕەچەتە"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-gray-200">
                            <Lock size={10} /> ئەدمین
                          </span>
                        )}
                      </div>
                    </div>
                    
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
              <p className="text-sm text-gray-500 mt-1">ئەو خەلتانەی دروستکراون - دەتوانیت هەڵەکان بسڕیتەوە یان دەستکاری بکەیت (تایبەت بە ئەدمین)</p>
            </div>
            <table className="w-full text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">ناوی خەلتە</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">بڕی دروستکراو</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">پێکهاتە بەکارهاتووەکان</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">بەروار</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600 text-center">کردارەکان (ئەدمین)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mixHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
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
                        {item.note && <span className="text-xs text-gray-500 block mt-0.5">{item.note}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-amber-50 text-amber-700 border border-amber-100">
                          + {item.amountProduced} کگم
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {item.ingredientsUsed?.map((ing: any, idx: number) => (
                            <span key={idx} className="text-xs font-bold text-gray-700 bg-white border border-gray-200 shadow-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                              {ing.productName}: <span className="text-red-500">-{ing.calculatedQuantity}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm font-medium">
                        {item.date?.toDate ? format(item.date.toDate(), 'yyyy/MM/dd HH:mm') : ''}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditMixNoteItem(item);
                                setNewMixNote(item.note || '');
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-1"
                              title="دەستکاریکردنی تێبینی"
                            >
                              <Edit2 size={13} />
                              <span>دەستکاری</span>
                            </button>
                            <button
                              onClick={() => setMixToDelete(item)}
                              className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg inline-flex items-center gap-1"
                              title="سڕینەوەی ئەم خەلتەیە و گەڕاندنەوەی کاڵاکان بۆ کۆگا"
                            >
                              <Trash2 size={13} />
                              <span>سڕینەوە</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            <Lock size={11} /> تەنیا ئەدمین
                          </span>
                        )}
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
                  <th className="px-6 py-4 text-sm font-bold text-gray-600 text-center">کردارەکان (ئەدمین)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
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
                      <td className="px-6 py-4 text-center">
                        {isAdmin ? (
                          <button
                            onClick={() => handleDeleteAddHistory(item)}
                            className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg inline-flex items-center gap-1"
                            title="سڕینەوەی ئەم زیادکردنە و کەمکردنەوە لە مەخزەن"
                          >
                            <Trash2 size={13} />
                            <span>سڕینەوە</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            <Lock size={11} /> ئەدمین
                          </span>
                        )}
                      </td>
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
              {editingRecipeId ? 'دەستکاریکردنی ڕەچەتە (ئەدمین)' : 'دروستکردنی ڕەچەتەی نوێ'}
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
                <button type="button" onClick={() => { setIsRecipeModalOpen(false); setEditingRecipeId(null); }} className="flex-1 px-6 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors">پاشگەزبوونەوە</button>
                <button type="submit" disabled={recipeForm.ingredients.length === 0} className="flex-[2] px-6 py-3.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-sm disabled:opacity-50">
                  {editingRecipeId ? 'پاشەکەوتکردنی دەستکاری' : 'پەسەندکردنی ڕەچەتە'}
                </button>
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
      {/* Delete Recipe Confirmation Modal */}
      {recipeToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 text-right animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-lg font-black text-gray-900 text-center mb-1">
              دڵنیایت لە سڕینەوەی ئەم ڕەچەتەیە؟
            </h3>
            <p className="text-xs text-gray-500 text-center mb-5">
              ڕەچەتەی <strong className="text-rose-600">"{recipeToDelete.name}"</strong> دەسڕدرێتەوە.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRecipeToDelete(null)}
                disabled={isDeletingRecipe}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRecipe}
                disabled={isDeletingRecipe}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isDeletingRecipe ? 'سڕینەوە...' : 'بەڵێ، بسڕەوە'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete & Revert Mix Confirmation Modal */}
      {mixToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 text-right animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-lg font-black text-gray-900 text-center mb-1">
              هەڵوەشاندنەوە و سڕینەوەی خەلتە؟
            </h3>
            <p className="text-xs text-gray-500 text-center mb-4">
              خەلتەی <strong className="text-amber-600">{mixToDelete.recipeName}</strong> بە بڕی <strong className="text-gray-900">+{mixToDelete.amountProduced} کگم</strong>
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 mb-5 space-y-1 text-right leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <ShieldCheck size={16} />
                <span>کاریگەریی ئەم هەڵوەشاندنەوەیە:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11.5px] pr-1">
                <li>بڕی ({mixToDelete.amountProduced} کگم) لە کۆگای بەرهەمهاتوو کەم دەکرێتەوە.</li>
                <li>پێکهاتە بەکارهاتووەکان دەگەڕێندرێنەوە سەر کۆگا بە تەواوی.</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMixToDelete(null)}
                disabled={isDeletingMix}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMixHistory}
                disabled={isDeletingMix}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isDeletingMix ? 'هەڵوەشاندنەوە...' : 'بەڵێ، هەڵبوەشێنەوە و بسڕەوە'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mix Note Modal */}
      {editMixNoteItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 text-right animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Edit2 size={18} className="text-amber-600" />
                دەستکاریکردنی تێبینیی خەلتە
              </h3>
              <button onClick={() => setEditMixNoteItem(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1.5">تێبینی</label>
              <textarea
                rows={3}
                value={newMixNote}
                onChange={(e) => setNewMixNote(e.target.value)}
                placeholder="تێبینی بنووسە..."
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditMixNoteItem(null)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'mix_history', editMixNoteItem.id), {
                      note: newMixNote,
                      updatedAt: serverTimestamp()
                    });
                    setEditMixNoteItem(null);
                  } catch (err: any) {
                    alert('هەڵەیەک ڕوویدا: ' + err.message);
                  }
                }}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs shadow-sm"
              >
                پاشەکەوتکردن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
