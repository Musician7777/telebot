import fs from 'fs/promises';
import path from 'path';

const COUNTER_FILE = 'counter.json';

// Initialize or read the current counter
const getNextCounter = async () => {
    try {
        let count = 0;
        try {
            const data = await fs.readFile(COUNTER_FILE, 'utf8');
            const json = JSON.parse(data);
            count = json.count || 0;
        } catch (error) {
            // File doesn't exist or is invalid, start at 0
        }

        count += 1;
        await fs.writeFile(COUNTER_FILE, JSON.stringify({ count }), 'utf8');
        return count;
    } catch (error) {
        console.error('Error updating counter:', error);
        return null;
    }
};

export default { getNextCounter };
