import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCalendar } from '../contexts/CalendarContext';

function CalendarSetupCallback() {
  const navigate = useNavigate();
  const { checkCalendarConnection } = useCalendar();

  useEffect(() => {
    const handleCallback = async () => {
      await checkCalendarConnection();
      
      // Get the return URL or default to home
      const returnUrl = sessionStorage.getItem('calendarReturnUrl') || '/';
      sessionStorage.removeItem('calendarReturnUrl');
      
      navigate(returnUrl);
    };

    handleCallback();
  }, []);

  return (
    <div className="calendar-setup-callback">
      <h2>Setting up Google Calendar...</h2>
      <p>Please wait while we complete the setup.</p>
    </div>
  );
}

export default CalendarSetupCallback; 