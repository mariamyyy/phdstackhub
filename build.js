const fs = require('fs');

// Replace with your real Google Sheets published CSV URL
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTe8yftdF5T-d_s7pNTxB6XUf54dTOwRBW1BKP7vyynSAlZbKbCeDnRHRXnSiyMHiWQfvvE0fhUdCIN/pub?output=csv";

async function buildSite() {
    try {
        console.log("Fetching latest rows from Google Sheets...");
        const response = await fetch(CSV_URL);
        const csvText = await response.text();
        
        // Parse CSV Rows
        const lines = csvText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
        
        const resources = lines.slice(1).map(line => {
            const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
            const cleanValues = values.map(v => v.replace(/^"|"$/g, '').trim());
            let obj = {};
            headers.forEach((header, index) => { obj[header] = cleanValues[index] || ""; });
            return obj;
        });

        // Generate Hardcoded HTML Blocks
        const htmlCards = resources.map(item => `
        <div class="card" data-keywords="${item.keywords || ''}">
            <div class="card-content">
                <h3><a href="${item.url}" target="_blank">${item.name}</a></h3>
                <p>${item.description}</p>
            </div>
            <span class="tag">${item.category}</span>
        </div>`).join('');

        // Inject inside our layout wrapper
        let template = fs.readFileSync('index.html', 'utf8');
        
        // Target container replacement
        const targetStart = '<!-- BUILD_TEMPLATE_START -->';
        const targetEnd = '<!-- BUILD_TEMPLATE_END -->';
        
        const staticContent = `
    <main class="grid" id="resourceGrid">
        ${htmlCards}
    </main>
    <script>
        // Static fast search mechanism
        const searchInput = document.getElementById('searchInput');
        const cards = document.querySelectorAll('.card');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            cards.forEach(card => {
                const keywords = card.getAttribute('data-keywords').toLowerCase();
                const content = card.textContent.toLowerCase();
                card.style.display = (keywords.includes(query) || content.includes(query)) ? 'flex' : 'none';
            });
        });
    </script>
        `;

        const regex = new RegExp(`${targetStart}[\\s\\S]*${targetEnd}`);
        const updatedHtml = template.replace(regex, `${targetStart}${staticContent}${targetEnd}`);
        
        fs.writeFileSync('index.html', updatedHtml);
        console.log("Success: index.html has been pre-rendered statically!");

    } catch (err) {
        console.error("Build failed: ", err);
        process.exit(1);
    }
}

buildSite();
