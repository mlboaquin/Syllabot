import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';

// Get the server URL from environment variable
const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

function PlotEventsButton({ events }) {
  const [isLoading, setIsLoading] = useState(false);
  const auth = getAuth();

  const handlePlotEvents = async () => {
    if (!events || events.length === 0) {
      alert('No events to plot!');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Attempting to plot events:', events);
      const token = await auth.currentUser.getIdToken();
      console.log('Got auth token:', token ? 'present' : 'missing');

      // Log the full URL being used
      const url = `${SERVER_URL}/api/events/batch`;
      console.log('Sending request to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ events }),
        credentials: 'include'
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(errorText || 'Failed to plot events');
      }

      const result = await response.json();
      console.log('Success response:', result);
      alert(`Successfully plotted ${result.successCount} events to your calendar!`);
    } catch (error) {
      console.error('Error plotting events:', error);
      alert(`Failed to plot events: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handlePlotEvents} 
      disabled={isLoading || !events?.length}
      className="plot-events-button"
    >
      {isLoading ? 'Plotting Events...' : 'Plot All Events to Calendar'}
    </button>
  );
}

export default PlotEventsButton; 