import React, { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import PDFUploader from './components/PDFUploader';
import EventList from './components/EventList';
import Login from './components/Login';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import { CalendarProvider } from './contexts/CalendarContext';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: "G-MPQHLHM494"
};

initializeApp(firebaseConfig);

function App() {
  const [user, setUser] = useState(null);
  const auth = getAuth();

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, [auth]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // User will be set to null automatically by the onAuthStateChanged listener
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthProvider>
      <CalendarProvider>
        <div className="App">
          <header className="App-header">
          <div className="logo-container">
            <img src="/robot.svg" alt="Syllabot" className="logo" />
            <h1>Syllabot</h1>
          </div>
          {user && (
            <div className="user-info">
              <span>Welcome, {user.displayName || user.email.split('@')[0]}</span>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </div>
          )}
        </header>
          <main>
            {user ? (
              <>
                <PDFUploader user={user} />
                <EventList user={user} />
              </>
            ) : (
              <Login />
            )}
          </main>
        </div>
      </CalendarProvider>
    </AuthProvider>
  );
}

export default App;