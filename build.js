const fs = require('fs');

// 🚀 Replace with your real Google Sheets published CSV URL
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTe8yftdF5T-d_s7pNTxB6XUf54dTOwRBW1BKP7vyynSAlZbKbCeDnRHRXnSiyMHiWQfvvE0fhUdCIN/pub?output=csv";

// Clean CSV line parsing engine (Handles quotes and inner commas perfectly)
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
        
        // CACHE BUSTER: Forces Google to deliver absolute fresh data
        const cacheBuster = `&t=${Date.now()}`;
        const finalUrl = CSV_URL.includes('?') ? `${CSV_URL}${cacheBuster}` : `${CSV_URL}?${cacheBuster}`;
        
        const response = await fetch(finalUrl);
        let csvText = await response.text();
        
        // 🚀 CRITICAL FIX: Strip the invisible Byte Order Mark (\uFEFF) if Google sends it
        if (csvText.startsWith('\uFEFF')) {
            csvText = csvText.substring(1);
        }
        
        // Split by lines and remove structural carriage return markers (\r)
        const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if(lines.length < 2) { throw new Error("CSV file looks empty or invalid."); }

        // Parse headers and scrub any lingering non-alphanumeric whitespace symbols
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, ''));
        console.log(`Scrubbed columns: ${headers.join(', ')}`);
        
        let resources = lines.slice(1).map(line => {
            const cleanValues = parseCSVLine(line);
            let obj = {};
            headers.forEach((header, index) => { 
                obj[header] = cleanValues[index] !== undefined ? cleanValues[index] : ""; 
            });
            return obj;
        });


        // 🚀 FEATURED SORT ENGINE: Pushes all items where 'is_featured' is true to the absolute top
        resources.sort((a, b) => {
            const aFeatured = (a.is_featured || '').toLowerCase() === 'true';
            const bFeatured = (b.is_featured || '').toLowerCase() === 'true';
            return bFeatured - aFeatured; 
        });

        // Generate Hardcoded HTML Blocks
        const htmlCards = resources.map(item => {
            // Safety fallbacks to prevent undefined text rendering
            const name = item.name || "Untitled Resource";
            const url = item.url || "#";
            const desc = item.description || "";
            const cat = item.category || "General";
            const kw = item.keywords || "";
            
            // 🚀 CHECK FEATURED STATUS: Safely looks for true values
            const isFeatured = (item.is_featured || '').toLowerCase() === 'true';
            
            // Dynamically build the CSS classes for this card container
            const cardClasses = isFeatured ? "card featured" : "card";
            
            // Inject a physical visual badge markup only if the item is featured
            const badgeHtml = isFeatured ? `<span class="featured-badge">Sponsored</span>` : "";

            return `
        <div class="${cardClasses}" data-keywords="${kw}">
            ${badgeHtml}
            <div class="card-content">
                <h3><a href="${url}" target="_blank">${name}</a></h3>
                <p>${desc}</p>
            </div>
            <span class="tag">${cat}</span>
        </div>`;
        }).join('');

        // Inject inside our layout wrapper
        let template = fs.readFileSync('index.html', 'utf8');
        
        // Target container replacement bounds
        const targetStart = '<!-- BUILD_TEMPLATE_START -->';
        const targetEnd = '<!-- BUILD_TEMPLATE_END -->';
        
        const staticContent = `
    <main class="grid" id="resourceGrid">
        ${htmlCards}
    </main>
    <script>
        // Static fast search mechanism
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
            throw new Error("Could not find <!-- BUILD_TEMPLATE_START --> variables in your index.html file!");
        }

        const updatedHtml = template.replace(regex, `${targetStart}${staticContent}${targetEnd}`);
        
        fs.writeFileSync('index.html', updatedHtml);
        console.log("Success: index.html compiled with featured slots on top!");

    } catch (err) {
        console.error("Build execution halted: ", err);
        process.exit(1);
    }
}

buildSite();
