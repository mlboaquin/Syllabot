import React, { useState, useEffect } from 'react';
import axios from 'axios';

function EventList({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await axios.get('http://localhost:3000/api/events', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        setEvents(response.data);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user]);

  return (
    <div className="event-list">
      <h2>Your Calendar Events</h2>
      {loading ? (
        <p>Loading events...</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <h3>{event.summary}</h3>
              <p>Start: {new Date(event.start.dateTime).toLocaleString()}</p>
              <p>End: {new Date(event.end.dateTime).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default EventList;