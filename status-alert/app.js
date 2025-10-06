// Configuration object - customize this section
const config = {
    // Status: 'maintenance' or 'deprecated'
    status: 'deprecated',
    
    // App name
    appName: 'vcf.iobio', // CHANGE!
    
    // Maintenance configuration (used if status is 'maintenance')
    maintenance: {
        reason: 'This page is currently under maintenance to improve your experience.',
        maintenanceStart: 'October 6, 2025',
        contact: 'iobioproject@gmail.com'
    },
    
    // Deprecated configuration (used if status is 'deprecated')
    deprecated: {
        reason: 'This application has been deprecated.',
        endOfLifeDate: 'October 6, 2025',
        githubUrl: 'https://github.com/iobio/vcf.iobio.io', // CHANGE!
        alternatives: [
            {
                name: 'Gene.iobio',
                url: 'https://gene.iobio.io/',
                description: 'View SNPs & indels and their associations in a fast and intuitive web application.'
            },
            {
                name: 'BAM.iobio',
                url: 'https://bam.iobio.io/',
                description: 'Quickly review bam files in your browser without any downloads or installations.'
            },
            {
                name: 'SV.iobio',
                url: 'https://mosaic-staging.chpc.utah.edu/sv.iobio/frontend/',
                description: 'View structural variants and their associations in an easy-to-use interface.'
            },
            {
                name: 'SimPheny.iobio',
                url: 'https://simpheny.iobio.chpc.utah.edu/',
                description: 'Use phenotypic information to prioritize genes based on similarity to diagnosed cases.'
            }
        ]
    }
};

function init() {
    const container = document.querySelector('.container');
    container.classList.add(config.status);
    
    if (config.status === 'maintenance') {
        renderMaintenancePage();
    } else if (config.status === 'deprecated') {
        renderDeprecatedPage();
    } else {
        renderErrorPage();
    }
}

function renderMaintenancePage() {
    const { maintenance, appName } = config;
    
    document.getElementById('statusIcon').textContent = '🔧';
    document.getElementById('statusTitle').textContent = `${appName}`;
    document.getElementById('statusMessage').textContent = maintenance.reason;
    
    // Details
    const detailsHtml = `
        ${`<div class="detail-item">
            <span class="detail-label">Check back in on this page in a few weeks, or contact us with quesitons.</span>
        </div>`}
        ${maintenance.maintenanceStart ? `<div class="detail-item">
            <span class="detail-label">Started:</span>
            <span class="detail-value">${maintenance.maintenanceStart}</span>
        </div>` : ''}
        ${maintenance.contact ? `<div class="detail-item">
            <span class="detail-label">Contact:</span>
            <span class="detail-value">${maintenance.contact}</span>
        </div>` : ''}
    `;
    
    document.getElementById('statusDetails').innerHTML = detailsHtml;
    document.getElementById('linksContainer').innerHTML = linksHtml;
}

function renderDeprecatedPage() {
    const { deprecated, appName } = config;
    
    document.getElementById('statusIcon').textContent = '⚠️';
    document.getElementById('statusTitle').textContent = `${appName}`;
    document.getElementById('statusMessage').textContent = deprecated.reason;
    
    // Details
    const detailsHtml = `
        ${deprecated.endOfLifeDate ? `<div class="detail-item">
            <span class="detail-label">End of Life:</span>
            <span class="detail-value">${deprecated.endOfLifeDate}</span>
        </div>` : ''}
        <div class="detail-item">
            <span class="detail-label">Status:</span>
            <span class="detail-value">No longer maintained</span>
        </div>
    `;
    
    document.getElementById('statusDetails').innerHTML = detailsHtml;
    
    // Links
    let linksHtml = '';
    
    if (deprecated.githubUrl) {
        linksHtml += `
            <a href="${deprecated.githubUrl}" class="link-button github" target="_blank" rel="noopener">
                View GitHub - <i class="thin">historical purposes</i>
            </a>
        `;
    }
    
    // Alternatives
    if (deprecated.alternatives && deprecated.alternatives.length > 0) {
        linksHtml += `
            <div class="alternatives">
                <h3>One or more of our current apps may have what you need ⬇️</h3>
                <div class="alternatives-list">
                    ${deprecated.alternatives.map(alt => `
                        <div class="alternative-item">
                            <a href="${alt.url}" target="_blank" rel="noopener">${alt.name}</a>
                            ${alt.description ? `<p class="alternative-description">${alt.description}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    document.getElementById('linksContainer').innerHTML = linksHtml;
}

// Error Page
function renderErrorPage() {
    document.getElementById('statusIcon').textContent = '❓';
    document.getElementById('statusTitle').textContent = 'Configuration Error';
    document.getElementById('statusMessage').textContent = 'Invalid status configuration. Please check the app.js file.';
    document.getElementById('statusDetails').innerHTML = '';
    document.getElementById('linksContainer').innerHTML = '';
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
