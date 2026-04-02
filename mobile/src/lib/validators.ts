//
//  validator.ts
//  
//
//  Created by Baptiste Briziou on 30/03/2026.
//

export function isValidEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}
