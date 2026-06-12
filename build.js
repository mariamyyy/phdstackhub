const fs = require('fs');

// 🚀 Replace with your real Google Sheets published CSV URL
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTe8yftdF5T-d_s7pNTxB6XUf54dTOwRBW1BKP7vyynSAlZbKbCeDnRHRXnSiyMHiWQfvvE0fhUdCIN/pub?output=csv";

// Clean CSV line parsing engine
function parseCSVLine(text) {
    let p = '', c = [];
    let q = false;
    for (let i = 0; i < text.length; i++) {
        let ch = text.charAt(i);
        if (ch === '"') { q = !q; }
        else if (ch === ',' && !q) { c.push(p.trim()); p = ''; }
        else { p += ch; }
    }
    c.push(p.trim());
    return c.map(v => v.replace(/^"|"$/g, '').trim());
}

async function buildSite() {
    try {
        console.log("Fetching latest rows from Google Sheets...");
        
        const cacheBuster = `&t=${Date.now()}`;
        const finalUrl = CSV_URL.includes('?') ? `${CSV_URL}${cacheBuster}` : `${CSV_URL}?${cacheBuster}`;
        
        const response = await fetch(finalUrl);
        let csvText = await response.text();
        
        // Strip Byte Order Mark if present
        if (csvText.startsWith('\uFEFF')) {
            csvText = csvText.substring(1);
        }
        
        const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if(lines.length < 2) { throw new Error("CSV file looks empty or invalid."); }

        // Standardize headers: lowercase and strip out hidden spaces
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, ''));
        console.log("Detected Spreadsheet Columns:", headers);
        
        let resources = lines.slice(1).map((line, lineIndex) => {
            const cleanValues = parseCSVLine(line);
            let obj = {};
            headers.forEach((header, index) => { 
                obj[header] = cleanValues[index] !== undefined ? cleanValues[index] : ""; 
            });
            return obj;
        });

        // Sort Engine: Pushes is_featured = TRUE to the top
        resources.sort((a, b) => {
            const aFeatured = String(a.is_featured || '').toLowerCase() === 'true';
            const bFeatured = String(b.is_featured || '').toLowerCase() === 'true';
            return bFeatured - aFeatured; 
        });

        // Generate HTML Layout Strings
        const htmlCards = resources.map(item => {
            const name = item.name || "Untitled Resource";
            const url = item.url || "#";
            const desc = item.description || "";
            const cat = item.category || "General";
            const kw = item.keywords || "";
            
            const isFeatured = String(item.is_featured || '').toLowerCase() === 'true';
            const cardClasses = isFeatured ? "card featured" : "card";
            const badgeHtml = isFeatured ? `<span class="featured-badge">Featured</span>` : "";

            return `
        <div class="${cardClasses}" data-keywords="${kw}">
            
            <div class="card-content">
                ${badgeHtml}
                <span class="tag">${cat}</span>
                <h3><a href="${url}" target="_blank">${name}</a></h3>
                <p>${desc}</p>
            </div>
            
        </div>`;
        }).join('');

        let template = fs.readFileSync('index.html', 'utf8');
        
        const targetStart = '<!-- BUILD_TEMPLATE_START -->';
        const targetEnd = '<!-- BUILD_TEMPLATE_END -->';
        
        const staticContent = `
    <main class="grid" id="resourceGrid">
        ${htmlCards}
    </main>
    <script>
        if (!window.searchInitialized) {
            window.searchInitialized = true;
            const searchInput = document.getElementById('searchInput');
            if(searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    const cards = document.querySelectorAll('.card');
                    cards.forEach(card => {
                        const keywords = (card.getAttribute('data-keywords') || '').toLowerCase();
                        const content = card.textContent.toLowerCase();
                        card.style.display = (keywords.includes(query) || content.includes(query)) ? 'flex' : 'none';
                    });
                });
            }
        }
    </script>
        `;

        const regex = new RegExp(`${targetStart}[\\s\\S]*${targetEnd}`);
        if(!regex.test(template)) {
            throw new Error("Could not find template comments inside index.html!");
        }

        const updatedHtml = template.replace(regex, `${targetStart}${staticContent}${targetEnd}`);
        fs.writeFileSync('index.html', updatedHtml);
        console.log(`Success: Pre-rendered ${resources.length} resources cleanly.`);

    } catch (err) {
        console.error("Build failed: ", err);
        process.exit(1);
    }
}

buildSite();
