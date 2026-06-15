'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './SearchBox.module.css';

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setQuery(value);
    
    if (value.trim().length > 1) {
      try {
        const res = await fetch(`http://localhost:8080/api/suggest?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.logo}>بيان</h1>
      <p className={styles.subtitle}>محرك بحث ذكي للطور الثانوي</p>
      
      <div ref={wrapperRef} className={`${styles.searchWrapper} ${isFocused ? styles.focused : ''}`}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <button type="submit" className={styles.searchIcon}>
            <svg focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="var(--secondary-text)"></path>
            </svg>
          </button>
          
          <input 
            type="text" 
            className={styles.searchInput}
            value={query}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            placeholder="ابحث عن دروس، ملخصات، مواضيع بكالوريا..."
            autoComplete="off"
            dir="rtl"
          />
        </form>
        
        {isFocused && suggestions.length > 0 && (
          <ul className={styles.suggestionsList}>
            {suggestions.map((suggestion, index) => (
              <li 
                key={index} 
                onClick={() => {
                  setQuery(suggestion);
                  setIsFocused(false);
                  window.location.href = `/search?q=${encodeURIComponent(suggestion)}`;
                }}
                className={styles.suggestionItem}
              >
                <svg className={styles.suggestionIcon} focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="var(--secondary-text)"></path>
                </svg>
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className={styles.actionButtons}>
        <button className={styles.btn} onClick={handleSearch}>بحث عربي</button>
        <button className={styles.btn}>ضربة حظ</button>
      </div>
    </div>
  );
}
