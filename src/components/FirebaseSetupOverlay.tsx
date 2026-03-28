import React from 'react';
import { Copy, CheckCircle2, ExternalLink } from 'lucide-react';

interface Props {
  onClose?: () => void;
}

export function FirebaseSetupOverlay({ onClose }: Props) {
  const [copied, setCopied] = React.useState(false);

  const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserRole() {
      return exists(/databases/$(database)/documents/users/$(request.auth.uid)) 
        ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role 
        : 'none';
    }
    
    function isAdmin() {
      return isAuthenticated() && (
        getUserRole() == 'admin' || 
        request.auth.token.email == "kurdb234@gmail.com" ||
        request.auth.token.email == "nabaz@hookah.com"
      );
    }

    function isManager() {
      return isAuthenticated() && getUserRole() == 'manager';
    }

    function isCashier() {
      return isAuthenticated() && getUserRole() == 'cashier';
    }
    
    function hasAnyRole() {
      return isAdmin() || isManager() || isCashier();
    }

    match /users/{userId} {
      allow read: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
      allow write: if isAdmin();
    }

    match /products/{productId} {
      allow read: if hasAnyRole();
      allow write: if isAdmin() || isManager();
      allow update: if isCashier() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['stock']);
    }

    match /sales/{saleId} {
      allow read: if hasAnyRole();
      allow create: if hasAnyRole();
      allow update, delete: if isAdmin();
    }

    match /debts/{debtId} {
      allow read: if hasAnyRole();
      allow create: if hasAnyRole();
      allow update: if hasAnyRole();
      allow delete: if isAdmin();
    }

    match /inventoryHistory/{historyId} {
      allow read: if isAdmin() || isManager();
      allow create: if isAdmin() || isManager();
      allow update, delete: if isAdmin();
    }

    match /settings/{settingId} {
      allow read: if hasAnyRole();
      allow write: if isAdmin();
    }
  }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(rules);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 bg-red-50">
          <h2 className="text-2xl font-bold text-red-700 flex items-center gap-2">
            ⚠️ پێویستە یاساکانی Firebase نوێ بکەیتەوە
          </h2>
          <p className="text-red-600 mt-2">
            سیستەمەکە ناتوانێت داتاکان بخوێنێتەوە یان بنووسێت چونکە یاساکانی پاراستن (Security Rules) لە Firebase ڕێگە نادەن.
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">هەنگاوەکان بۆ چارەسەرکردن:</h3>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                بڕۆ بۆ ماڵپەڕی{' '}
                <a 
                  href="https://console.firebase.google.com/project/aras-hookah-shop/firestore/rules" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                >
                  Firebase Console <ExternalLink size={16} />
                </a>
              </li>
              <li>پڕۆژەکەت هەڵبژێرە (aras-hookah-shop).</li>
              <li>لە بەشی <strong>Firestore Database</strong>، بڕۆ بۆ تابی <strong>Rules</strong>.</li>
              <li>هەموو کۆدی ناو ئەو بەشە بسڕەوە و ئەم کۆدەی خوارەوەی تێدا دابنێ:</li>
            </ol>
          </div>

          <div className="relative group">
            <div className="absolute right-2 top-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                {copied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
                {copied ? 'کۆپی کرا' : 'کۆپیکردن'}
              </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-sm font-mono text-left" dir="ltr">
              <code>{rules}</code>
            </pre>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-blue-800 text-sm">
              <strong>تێبینی:</strong> دوای ئەوەی کۆدەکەت دانا، کرتە لەسەر دوگمەی <strong>Publish</strong> بکە. پاشان ئەم پەنجەرەیە دابخە و وێبسایتەکە ڕیفرێش بکە.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={() => {
              if (onClose) onClose();
              window.location.reload();
            }}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            تەواوم کرد (ڕیفرێش)
          </button>
        </div>
      </div>
    </div>
  );
}
