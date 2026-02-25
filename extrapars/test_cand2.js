const fs = require('fs');

async function main() {
    const code = fs.readFileSync('/Users/maksimmaksim/Desktop/max_parser/server.js', 'utf8');
    const evalCode = code.replace('const server = http.createServer', 'module.exports = { loadMaxChartCandidates }; const server = {listen: ()=>{}}; //');
    fs.writeFileSync('/Users/maksimmaksim/Desktop/max_parser/temp_server.js', evalCode);
    const temp = require('./temp_server.js');
    const cands = await temp.loadMaxChartCandidates();
    console.log("Total candidates:", cands.length);
    const found = cands.find(c => c.slug.includes('aquagizer'));
    console.log("Found:", found);
}

main().catch(console.error);
