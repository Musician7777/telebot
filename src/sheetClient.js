import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

// Config from environment variables
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// handle escaped newlines in private key
const SA_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

export const addToSheet = async (data) => {
    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
        console.warn('⚠️ Google Sheets credentials not set. Backup skipped.');
        return;
    }

    try {
        const serviceAccountAuth = new JWT({
            email: SA_EMAIL,
            key: SA_KEY,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

        await doc.loadInfo();

        // Get the first sheet
        const sheet = doc.sheetsByIndex[0];

        // Load rows to check if sheet has any data
        await sheet.loadCells();

        // Check if sheet is empty (no rows at all) or has no header values
        if (sheet.rowCount === 0 || sheet.cellStats.nonEmpty === 0) {
            console.log('📝 Empty sheet detected. Initializing headers...');
            await sheet.setHeaderRow([
                'File Name',
                'Package Name',
                'Google Play Link',
                'F-Droid Link',
                'File Size',
                'Time'
            ]);
        }

        // Now load the header row (this should work since headers exist)
        await sheet.loadHeaderRow();

        // Prepare row data
        const row = {
            'File Name': data.fileName,
            'Package Name': data.packageName,
            'Google Play Link': data.googlePlayLink || '',
            'F-Droid Link': data.fDroidLink || '',
            'File Size': data.fileSize,
            'Time': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        };

        await sheet.addRow(row);
        console.log('✅ Added to Google Sheet backup.');

    } catch (error) {
        console.error('❌ Failed to add to Google Sheet:', error.message);
    }
};
