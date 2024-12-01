import React from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

function Login() {
  const handleLogin = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  return (
    <div className="login-container">
      <h2>Please sign in to continue</h2>
      <button onClick={handleLogin} className="login-button">
        Sign in with Google
      </button>
    </div>
  );
}

export default Login;