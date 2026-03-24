import React, { createContext, useContext, useState } from 'react';

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [favorites, setFavorites] = useState([]);
  const [communitySavings, setCommunitySavings] = useState(45000); // Dynamic in prod

  const toggleFavorite = (itemId) => {
    setFavorites(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId) 
        : [...prev, itemId]
    );
  };

  const isFavorite = (itemId) => favorites.includes(itemId);

  return (
    <GlobalContext.Provider value={{ favorites, toggleFavorite, isFavorite, communitySavings }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = () => useContext(GlobalContext);
