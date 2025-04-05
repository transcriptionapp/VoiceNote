// events.js
export const EventDispatcher = {
    dispatch(eventName, data) {
      console.log(`Dispatching event: ${eventName}`, data); // Log when an event is dispatched
      const event = new CustomEvent(eventName, { detail: data });
      window.dispatchEvent(event);
    },
  
    on(eventName, callback) {
      console.log(`Listening for event: ${eventName}`); // Log when an event listener is registered
      window.addEventListener(eventName, (e) => {
        console.log(`Event received: ${eventName}`, e.detail); // Log when the event is received
        callback(e.detail);
      });
    }
  };