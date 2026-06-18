'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();
const API_BASE = "http://localhost:8080";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if token exists in localStorage on startup
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      fetchCurrentUser(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async (authToken) => {
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setToken(authToken);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        // Token is invalid or expired
        logout();
      }
    } catch (err) {
      console.error("Error fetching current user:", err);
      // Keep offline fallback if server is down temporarily but user details exist
      const cachedUser = localStorage.getItem('user');
      if (cachedUser) {
        setUser(JSON.parse(cachedUser));
        setToken(authToken);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setError(null);
    try {
      // OAuth2 request requires form urlencoded data
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const accessToken = data.access_token;
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
        
        // Fetch user info
        await fetchCurrentUser(accessToken);
        return true;
      } else {
        const errData = await res.json();
        setError(errData.detail || "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        return false;
      }
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.");
      return false;
    }
  };

  const register = async (fullName, email, password) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: fullName,
          email: email,
          password: password
        })
      });

      if (res.ok) {
        // Auto login after successful registration
        return await login(email, password);
      } else {
        const errData = await res.json();
        setError(errData.detail || "فشل إنشاء الحساب. قد يكون البريد الإلكتروني مسجلاً بالفعل.");
        return false;
      }
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم. يرجى المحاولة لاحقاً.");
      return false;
    }
  };

  const socialLogin = async (fullName, email, provider, signed_token, timestamp) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: fullName,
          email: email,
          provider: provider,
          signed_token: signed_token,
          timestamp: timestamp
        })
      });

      if (res.ok) {
        const data = await res.json();
        const accessToken = data.access_token;
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
        
        // Fetch user info
        await fetchCurrentUser(accessToken);
        return true;
      } else {
        const errData = await res.json();
        setError(errData.detail || "فشل تسجيل الدخول الاجتماعي.");
        return false;
      }
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم. يرجى المحاولة لاحقاً.");
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  const updateProfile = async (fullName, level, branch) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: fullName,
          level: level,
          branch: branch
        })
      });

      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        return true;
      } else {
        const errData = await res.json();
        setError(errData.detail || "فشل تحديث بيانات الملف الشخصي.");
        return false;
      }
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم لتحديث البيانات.");
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, logout, setError, socialLogin, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
