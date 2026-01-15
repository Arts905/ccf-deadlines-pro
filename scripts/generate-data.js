const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');

const dataDir = path.join(__dirname, '../ccf-deadlines-main/conference');
const outputDir = path.join(__dirname, '../public');
const outputFile = path.join(outputDir, 'conferences.json');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Category mapping
const categoryMap = {
  'DS': 'Computer Architecture/Parallel Programming/Storage Technology',
  'NW': 'Network System',
  'SC': 'Network and System Security',
  'SE': 'Software Engineering/Operating System/Programming Language Design',
  'DB': 'Database/Data Mining/Information Retrieval',
  'CT': 'Computing Theory',
  'CG': 'Graphics',
  'AI': 'Artificial Intelligence',
  'HI': 'Computer-Human Interaction',
  'MX': 'Interdiscipline/Mixture/Emerging'
};

function processConf(data, file) {
    // Add category name
    if (data.sub && categoryMap[data.sub]) {
        data.subName = categoryMap[data.sub];
    }
    
    // Add file path for debugging/reference
    data.sourceFile = path.relative(dataDir, file);
    
    return data;
}

function generateData() {
  console.log('Searching for YAML files in:', dataDir);
  
  // Find all YAML files
  const files = glob.sync(`${dataDir}/**/*.yml`);
  console.log(`Found ${files.length} conference files.`);

  const conferences = [];

  files.forEach(file => {
    // Skip types.yml
    if (file.endsWith('types.yml')) {
        return;
    }

    try {
      const content = fs.readFileSync(file, 'utf8');
      const data = yaml.load(content);
      
      if (data) {
          const items = Array.isArray(data) ? data : [data];
          
          items.forEach(item => {
              if (item && typeof item === 'object') {
                  // Validate it's a conference object
                  // Must have 'title' and 'confs'
                  if (item.title && item.confs) {
                      conferences.push(processConf(item, file));
                  }
              }
          });
      }
    } catch (e) {
      console.error(`Error parsing ${file}:`, e.message);
    }
  });

  console.log(`Processed ${conferences.length} conferences.`);
  
  fs.writeFileSync(outputFile, JSON.stringify(conferences, null, 2));
  console.log(`Data written to ${outputFile}`);
}

generateData();
