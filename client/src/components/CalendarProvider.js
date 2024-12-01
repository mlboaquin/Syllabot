import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext'; // Assuming you have an auth context

const CalendarContext = createContext();

export function CalendarProvider({ children }) {
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const checkCalendarConnection = async () => {
    if (!user) {
      setCalendarConnected(false);
      setLoading(false);
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await axios.get('http://localhost:3000/api/auth/google/status', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      setCalendarConnected(response.data.connected);
    } catch (error) {
      console.error('Failed to check calendar connection:', error);
      setCalendarConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkCalendarConnection();
  }, [user]);

  return (
    <CalendarContext.Provider 
      value={{ 
        calendarConnected, 
        setCalendarConnected, 
        loading,
        checkCalendarConnection 
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}