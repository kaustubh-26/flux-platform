
// Check if the code is running in a browser environment
export const isBrowser = typeof window !== "undefined";

// Class providing utility functions for local storage
export class LocalStorage {
    // Get value from local storage
    static get(key: string) {
        if(!isBrowser) return;
        const value = localStorage.getItem(key);
        if(value) {
            try {
                return JSON.parse(value);
            } catch (err) {
                return null;
            }
        }
        return null;
    }

    // Set value in local storage
    static set(key: string, value: any) {
        if(!isBrowser) return;
        localStorage.setItem(key, JSON.stringify(value));
    }

    // Remove value from local storage
    static remove(key: string) {
        if(!isBrowser) return;
        localStorage.removeItem(key);
    }

    // Clear all items in local storage
    static clear() {
        if(!isBrowser) return;
        localStorage.clear();
    }
}