// src/components/playStorage.js

const LOCAL_STORAGE_KEY = 'userSavedPlays';

/**
 * Retrieves all saved plays from Local Storage.
 * @returns {Array<{name: string, routeData: Object}>} An array of saved play objects.
 */
export const loadSavedPlays = () => {
    try {
        const savedPlaysJson = localStorage.getItem(LOCAL_STORAGE_KEY);
        // Use an empty array if parsing fails or nothing is found
        const savedPlays = savedPlaysJson ? JSON.parse(savedPlaysJson) : [];
        // Ensure the return value is an array, even if empty
        return Array.isArray(savedPlays) ? savedPlays : []; 
    } catch (error) {
        // Fallback for security/malformed storage error
        console.error("Error loading saved plays from Local Storage:", error);
        return [];
    }
};

/**
 * Saves a new play to Local Storage, or updates an existing one.
 * @param {string} playName - The unique name for the play.
 * @param {Object} routeData - The complete routeData state to save.
 */
export const savePlay = (playName, routeData) => {
    // We call loadSavedPlays() which handles retrieval safely
    const savedPlays = loadSavedPlays(); 
    const newPlay = { name: playName, routeData: routeData };
    
    // Check if a play with this name already exists
    const existingIndex = savedPlays.findIndex(play => play.name === playName);
    
    if (existingIndex !== -1) {
        // Update existing play
        savedPlays[existingIndex] = newPlay;
    } else {
        // Add new play
        savedPlays.push(newPlay);
    }

    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedPlays));
        return { success: true, message: `Play '${playName}' saved successfully.` };
    } catch (error) {
        console.error("Error saving play to Local Storage:", error);
        return { success: false, message: "Could not save play. Local Storage may be full or unavailable." };
    }
};

/**
 * Deletes a play by name from Local Storage.
 * @param {string} playName - The name of the play to delete.
 */
export const deletePlay = (playName) => {
    const savedPlays = loadSavedPlays();
    const updatedPlays = savedPlays.filter(play => play.name !== playName);
    
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPlays));
        return { success: true, message: `Play '${playName}' deleted successfully.` };
    } catch (error) {
        console.error("Error deleting play from Local Storage:", error);
        return { success: false, message: "Could not delete play." };
    }
};