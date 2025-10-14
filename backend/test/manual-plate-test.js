/**
 * Test Manuale PlateLoadingService - CLI Interactive
 * 
 * Uso:
 *   node test/manual-plate-test.js SQUAT 100
 *   node test/manual-plate-test.js DIP 50
 *   node test/manual-plate-test.js MILITARY_PRESS 80
 * 
 * Oppure senza argomenti per modalità interattiva
 */

import plateLoadingService from '../src/services/plateLoadingService.js';
import readline from 'readline';

// Colori ANSI per output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

// Mapping colori dischi
const plateColors = {
  'red': colors.red,
  'blue': colors.blue,
  'yellow': colors.yellow,
  'green': colors.green,
  'white': colors.white,
  'black': colors.gray,
  'chrome': colors.cyan,
  'silver': colors.white,
  'silver-small': colors.white
};

function printBanner() {
  console.log('\n' + colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset);
  console.log(colors.cyan + '   🏋️  PLATE LOADING CALCULATOR - STREET CONTROL  🏋️' + colors.reset);
  console.log(colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset + '\n');
}

function printPlateLoading(result, liftName, targetWeight, isRecordAttempt = false) {
  console.log('\n' + colors.yellow + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(`${colors.magenta}📊 ALZATA:${colors.reset} ${liftName.toUpperCase()}`);
  console.log(`${colors.magenta}🎯 PESO TARGET:${colors.reset} ${targetWeight}kg`);
  if (isRecordAttempt) {
    console.log(`${colors.red}🏆 TENTATIVO DI RECORD${colors.reset} ${colors.gray}(incrementi 0.5kg/1kg permessi)${colors.reset}`);
  }
  console.log(colors.yellow + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);

  if (!result.isValid) {
    console.log(`\n${colors.red}❌ ERRORE: ${result.error}${colors.reset}\n`);
    return;
  }

  console.log(`\n${colors.green}✅ PESO VALIDO${colors.reset}`);
  console.log(`${colors.cyan}📦 Peso Totale:${colors.reset} ${result.totalWeight}kg`);

  if (result.useBarbell) {
    console.log(`${colors.cyan}🔧 Bilanciere:${colors.reset} ${result.barbellWeight}kg`);
    console.log(`${colors.cyan}⚖️  Peso per Lato:${colors.reset} ${result.weightPerSide}kg`);
    console.log(`${colors.gray}   (visualizzazione per lato ${result.displaySide})${colors.reset}`);
  } else {
    console.log(`${colors.cyan}⚙️  Tipo Carico:${colors.reset} Cintura (peso diretto)`);
  }

  console.log(`\n${colors.yellow}🎨 DISCHI DA CARICARE:${colors.reset}`);
  console.log(colors.yellow + '─────────────────────────────────────────────────────' + colors.reset);

  if (result.plates.length === 0) {
    console.log(`  ${colors.gray}(nessun disco - solo bilanciere)${colors.reset}`);
  } else {
    result.plates.forEach((plate, index) => {
      const colorCode = plateColors[plate.color] || colors.white;
      const qtyText = result.useBarbell ? `${plate.qty} disco/i per lato` : `${plate.qty} disco/i`;
      const weightText = result.useBarbell ? `(${plate.weight * plate.qty}kg per lato)` : `(${plate.weight * plate.qty}kg totale)`;
      
      console.log(`  ${index + 1}. ${colorCode}⬤${colors.reset} ${plate.label.padEnd(20)} × ${qtyText} ${colors.gray}${weightText}${colors.reset}`);
    });
  }

  // Visualizzazione grafica del bilanciere (solo per alzate con bilanciere)
  if (result.useBarbell && result.plates.length > 0) {
    console.log(`\n${colors.cyan}📏 VISUALIZZAZIONE LATO BILANCIERE:${colors.reset}`);
    console.log(colors.yellow + '─────────────────────────────────────────────────────' + colors.reset);
    
    let visual = '  ║';
    result.plates.forEach(plate => {
      const colorCode = plateColors[plate.color] || colors.white;
      const diskChar = plate.weight >= 10 ? '█' : '▌';
      for (let i = 0; i < plate.qty; i++) {
        visual += `${colorCode}${diskChar}${colors.reset}`;
      }
    });
    visual += '║';
    
    console.log(visual);
  }

  console.log(colors.yellow + '─────────────────────────────────────────────────────' + colors.reset + '\n');
}

function testPlateLoading(liftName, targetWeight, isRecordAttempt = false) {
  printBanner();
  
  const result = plateLoadingService.calculatePlateLoading(targetWeight, liftName, { isRecordAttempt });
  printPlateLoading(result, liftName, targetWeight, isRecordAttempt);
  
  // Mostra incremento minimo
  const minIncrement = plateLoadingService.getMinimumIncrement(liftName);
  const allowedIncrements = plateLoadingService.getAllowedIncrements(liftName, isRecordAttempt);
  console.log(`${colors.cyan}📏 Incrementi permessi:${colors.reset} ${allowedIncrements.join('kg, ')}kg`);
  console.log('');
  
  // Suggerimenti se peso non valido
  if (!result.isValid) {
    console.log(`${colors.cyan}💡 SUGGERIMENTI PESI VALIDI VICINI:${colors.reset}`);
    const suggestions = plateLoadingService.getSuggestedWeights(targetWeight, liftName, 10);
    
    if (suggestions.length > 0) {
      suggestions.slice(0, 5).forEach((sug, idx) => {
        const diff = sug.difference > 0 ? `+${sug.difference.toFixed(2)}` : sug.difference.toFixed(2);
        console.log(`  ${idx + 1}. ${sug.weight}kg ${colors.gray}(${diff}kg dal target)${colors.reset}`);
      });
    } else {
      console.log(`  ${colors.gray}Nessun peso valido trovato nel range${colors.reset}`);
    }
    console.log('');
  }
}

function testPlateChange(liftName, fromWeight, toWeight, isRecordAttempt = false) {
  printBanner();
  
  console.log(colors.magenta + '🔄 CAMBIO DISCHI TRA TENTATIVI' + colors.reset);
  console.log(colors.yellow + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(`${colors.cyan}Alzata:${colors.reset} ${liftName.toUpperCase()}`);
  console.log(`${colors.cyan}Da:${colors.reset} ${fromWeight}kg → ${colors.cyan}A:${colors.reset} ${toWeight}kg`);
  if (isRecordAttempt) {
    console.log(`${colors.red}🏆 TENTATIVO DI RECORD${colors.reset} ${colors.gray}(incrementi 0.5kg/1kg permessi)${colors.reset}`);
  }
  console.log(colors.yellow + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');
  
  // Valida incremento
  const validation = plateLoadingService.validateWeightIncrement(fromWeight, toWeight, liftName, isRecordAttempt);
  
  if (!validation.isValid) {
    console.log(`${colors.red}❌ INCREMENTO NON VALIDO: ${validation.error}${colors.reset}`);
    console.log(`${colors.cyan}Incremento richiesto:${colors.reset} ${validation.increment}kg`);
    console.log(`${colors.cyan}Incrementi permessi:${colors.reset} ${validation.allowedIncrements.join('kg, ')}kg\n`);
    return;
  }
  
  const change = plateLoadingService.calculatePlateChange(fromWeight, toWeight, liftName);
  
  if (change.error) {
    console.log(`${colors.red}❌ ERRORE: ${change.error}${colors.reset}\n`);
    return;
  }
  
  console.log(`${colors.green}✅ CAMBIO VALIDO${colors.reset}`);
  console.log(`${colors.cyan}Differenza:${colors.reset} ${change.weightDifference > 0 ? '+' : ''}${change.weightDifference}kg`);
  console.log(`${colors.cyan}Incremento:${colors.reset} ${validation.increment}kg ${validation.isRecordAttempt ? colors.red + '🏆' + colors.reset : ''}\n`);
  
  // Dischi da rimuovere
  console.log(`${colors.red}🔻 DISCHI DA RIMUOVERE:${colors.reset}`);
  if (change.toRemove.length === 0) {
    console.log(`  ${colors.gray}(nessuno)${colors.reset}`);
  } else {
    change.toRemove.forEach((plate, idx) => {
      const colorCode = plateColors[plate.color] || colors.white;
      console.log(`  ${idx + 1}. ${colorCode}⬤${colors.reset} ${plate.label.padEnd(20)} × ${plate.qty}`);
    });
  }
  
  console.log('');
  
  // Dischi da aggiungere
  console.log(`${colors.green}🔺 DISCHI DA AGGIUNGERE:${colors.reset}`);
  if (change.toAdd.length === 0) {
    console.log(`  ${colors.gray}(nessuno)${colors.reset}`);
  } else {
    change.toAdd.forEach((plate, idx) => {
      const colorCode = plateColors[plate.color] || colors.white;
      console.log(`  ${idx + 1}. ${colorCode}⬤${colors.reset} ${plate.label.padEnd(20)} × ${plate.qty}`);
    });
  }
  
  console.log('');
}

// Modalità interattiva
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (query) => new Promise((resolve) => rl.question(query, resolve));
  
  printBanner();
  
  console.log(colors.cyan + 'MODALITÀ INTERATTIVA' + colors.reset);
  console.log(colors.gray + 'Premi Ctrl+C per uscire\n' + colors.reset);
  
  while (true) {
    console.log(colors.yellow + '\nAlzate disponibili:' + colors.reset);
    console.log('  1. SQUAT (bilanciere)');
    console.log('  2. MILITARY_PRESS (bilanciere)');
    console.log('  3. DIP (cintura)');
    console.log('  4. PULL (cintura)');
    console.log('  5. MU (cintura)');
    console.log('  6. Test cambio dischi');
    console.log('  7. Mostra configurazione incrementi');
    console.log('  0. Esci\n');
    
    const choice = await question(colors.cyan + 'Seleziona opzione (0-7): ' + colors.reset);
    
    if (choice === '0') {
      console.log(colors.green + '\n👋 Arrivederci!\n' + colors.reset);
      rl.close();
      break;
    }
    
    const lifts = ['', 'SQUAT', 'MILITARY_PRESS', 'DIP', 'PULL', 'MU'];
    const liftName = lifts[parseInt(choice)];
    
    if (choice === '6') {
      // Test cambio dischi
      const lift = await question(colors.cyan + 'Alzata (SQUAT/DIP/etc): ' + colors.reset);
      const from = parseFloat(await question(colors.cyan + 'Peso iniziale (kg): ' + colors.reset));
      const to = parseFloat(await question(colors.cyan + 'Peso finale (kg): ' + colors.reset));
      const isRecord = (await question(colors.cyan + 'È un tentativo di record? (s/n): ' + colors.reset)).toLowerCase() === 's';
      
      console.clear();
      testPlateChange(lift.toUpperCase(), from, to, isRecord);
    } else if (choice === '7') {
      // Mostra configurazione incrementi
      console.clear();
      printBanner();
      const config = plateLoadingService.getIncrementsConfig();
      
      console.log(colors.magenta + '⚙️  CONFIGURAZIONE INCREMENTI' + colors.reset);
      console.log(colors.yellow + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
      
      console.log(`\n${colors.cyan}📊 INCREMENTI STANDARD (tra tentativi normali):${colors.reset}`);
      Object.entries(config.standard).forEach(([lift, increment]) => {
        console.log(`  • ${lift.padEnd(15)} → ${increment}kg`);
      });
      
      console.log(`\n${colors.red}🏆 INCREMENTI RECORD (tentativo di record):${colors.reset}`);
      console.log(`  ${config.record.join('kg, ')}kg ${colors.gray}(oltre l'incremento standard)${colors.reset}`);
      console.log('');
    } else if (liftName) {
      const weight = parseFloat(await question(colors.cyan + 'Peso target (kg): ' + colors.reset));
      const isRecord = (await question(colors.cyan + 'È un tentativo di record? (s/n): ' + colors.reset)).toLowerCase() === 's';
      
      console.clear();
      testPlateLoading(liftName, weight, isRecord);
    } else {
      console.log(colors.red + '\n❌ Scelta non valida!\n' + colors.reset);
    }
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  // Modalità interattiva
  interactiveMode().catch(console.error);
} else if (args.length === 2) {
  // Modalità comando: node manual-plate-test.js SQUAT 100
  const [liftName, targetWeight] = args;
  testPlateLoading(liftName.toUpperCase(), parseFloat(targetWeight), false);
} else if (args.length === 3 && args[2].toLowerCase() === 'record') {
  // Modalità record: node manual-plate-test.js SQUAT 100 record
  const [liftName, targetWeight] = args;
  testPlateLoading(liftName.toUpperCase(), parseFloat(targetWeight), true);
} else if (args.length === 3 && args[0] === 'change') {
  // Modalità cambio: node manual-plate-test.js change SQUAT 60 100
  console.log(colors.red + '❌ Uso: node manual-plate-test.js change <LIFT> <FROM> <TO> [record]' + colors.reset);
  console.log(colors.gray + 'Esempio: node manual-plate-test.js change SQUAT 60 100' + colors.reset);
  console.log(colors.gray + 'Esempio: node manual-plate-test.js change SQUAT 60 100.5 record\n' + colors.reset);
} else if (args.length === 4 && args[0] === 'change') {
  const [_, liftName, fromWeight, toWeight] = args;
  testPlateChange(liftName.toUpperCase(), parseFloat(fromWeight), parseFloat(toWeight), false);
} else if (args.length === 5 && args[0] === 'change' && args[4].toLowerCase() === 'record') {
  const [_, liftName, fromWeight, toWeight] = args;
  testPlateChange(liftName.toUpperCase(), parseFloat(fromWeight), parseFloat(toWeight), true);
} else if (args.length === 1 && args[0] === 'config') {
  // Mostra configurazione
  printBanner();
  const config = plateLoadingService.getIncrementsConfig();
  
  console.log(colors.magenta + '⚙️  CONFIGURAZIONE INCREMENTI' + colors.reset);
  console.log(colors.yellow + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  
  console.log(`\n${colors.cyan}📊 INCREMENTI STANDARD:${colors.reset}`);
  Object.entries(config.standard).forEach(([lift, increment]) => {
    console.log(`  • ${lift.padEnd(15)} → ${increment}kg`);
  });
  
  console.log(`\n${colors.red}🏆 INCREMENTI RECORD:${colors.reset}`);
  console.log(`  ${config.record.join('kg, ')}kg\n`);
} else {
  console.log(colors.red + '\n❌ Uso non corretto!\n' + colors.reset);
  console.log(colors.cyan + 'Opzioni:' + colors.reset);
  console.log('  1. Modalità interattiva:');
  console.log(colors.gray + '     node test/manual-plate-test.js' + colors.reset);
  console.log('\n  2. Test singolo peso:');
  console.log(colors.gray + '     node test/manual-plate-test.js SQUAT 100' + colors.reset);
  console.log(colors.gray + '     node test/manual-plate-test.js SQUAT 100 record' + colors.reset);
  console.log('\n  3. Test cambio dischi:');
  console.log(colors.gray + '     node test/manual-plate-test.js change SQUAT 60 100' + colors.reset);
  console.log(colors.gray + '     node test/manual-plate-test.js change SQUAT 60 100.5 record' + colors.reset);
  console.log('\n  4. Mostra configurazione:');
  console.log(colors.gray + '     node test/manual-plate-test.js config' + colors.reset);
  console.log('');
}
