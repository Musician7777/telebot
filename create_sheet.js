import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

async function createSheet() {
    if (!SA_EMAIL || !SA_KEY) {
        console.error('❌ Service Account Credentials missing in .env');
        return;
    }

    try {
        const serviceAccountAuth = new JWT({
            email: SA_EMAIL,
            key: SA_KEY,
            scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
        });

        console.log('⏳ Creating new Google Sheet...');
        const doc = await GoogleSpreadsheet.createNewSpreadsheetDocument(serviceAccountAuth, { title: 'Telebot APK Backups' });

        // Set headers
        const sheet = doc.sheetsByIndex[0];
        await sheet.setHeaderRow([
            'File Name',
            'Package Name',
            'Google Play Link',
            'F-Droid Link',
            'File Size',
            'Time'
        ]);

        // Share with anyone with link (simpler for user access) or user calls could set permissions properly if we had their email.
        // For now we just output the URL.

        // IMPORTANT: By default, the SHEET is created inside the Service Account's Drive (which is invisible to you).
        // We need to SHARE it with you. However, I don't know your email.
        // So I will make it public to anyone with the link so you can open it, 
        // and then YOU should immediately change permissions/add yourself as owner.

        // Alternatively, I can just print the ID and you can try to "add" it, but the URL is best.
        // Actually, 'createNewSpreadsheetDocument' creates it in the SA's drive.
        // We need to add permission for the user. Since I don't have user Google Email, 
        // I will try to make it readable/writable by anyone with link or just output the ID.
        // The google-spreadsheet library might not expose sharing easily without 'google-drive' apis.

        // Let's just output the ID and URL. The user MUST share it with themselves if they want to see it easily 
        // or we can use the drive API to add permissions.
        // Wait, if I create it with SA, the SA is the owner. I can't "share" it easily without the drive API.

        console.log('\n✅ Sheet Created Successfully!');
        console.log('------------------------------------------------');
        console.log(`📄 Title: ${doc.title}`);
        console.log(`🔗 URL: https://docs.google.com/spreadsheets/d/${doc.spreadsheetId}/edit`);
        console.log(`id: ${doc.spreadsheetId}`);
        console.log('------------------------------------------------');
        console.log('⚠️ IMPORTANT: This sheet was created by the Service Account.');
        console.log('   You might NOT be able to open it directly unless you share it with your personal email.');
        console.log('   Since I don\'t have your email, I cannot share it with you automatically.');
        console.log('\n   RECOMMENDATION: It is better if YOU create the sheet manually in your browser,');
        console.log('   and then just copy the ID from the URL into your .env file.');

    } catch (error) {
        console.error('❌ Failed to create sheet:', error.message);
    }
}

createSheet();
