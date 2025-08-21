import React from 'react';
import { Check, X } from 'lucide-react';

const PasswordStrength = ({ password }) => {
  const getStrength = () => {
    let score = 0;
    if (!password) return 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const strengthText = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strength];
  const strengthColor = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-600'][strength];

  const checks = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'An uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'A lowercase letter', valid: /[a-z]/.test(password) },
    { label: 'A number', valid: /[0-9]/.test(password) },
    { label: 'A special character', valid: /[^A-Za-z0-9]/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      <div className="flex items-center gap-2">
        <div className="w-full bg-slate-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${strengthColor}`}
            style={{ width: `${(strength / 5) * 100}%` }}
          ></div>
        </div>
        <span className="text-xs font-medium w-24 text-right text-slate-600">{strengthText}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
        {checks.map((check, index) => (
          <div key={index} className={`flex items-center gap-1.5 transition-colors ${check.valid ? 'text-green-600' : 'text-slate-500'}`}>
            {check.valid ? <Check size={14} className="flex-shrink-0" /> : <X size={14} className="flex-shrink-0" />}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrength;