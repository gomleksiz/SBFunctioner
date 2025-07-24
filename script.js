let functionSyntax = {};
let validFunctionNames = [];

document.addEventListener('DOMContentLoaded', () => {
    fetch('functions.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            functionSyntax = data;
            validFunctionNames = Object.keys(functionSyntax);
            console.log("Function syntax loaded successfully.");
            
            // Check if there's a function parameter in the URL (coming from generator page)
            const urlParams = new URLSearchParams(window.location.search);
            const functionParam = urlParams.get('function');
            
            if (functionParam) {
                const inputElement = document.getElementById('functionInput');
                if (inputElement) {
                    inputElement.value = functionParam;
                    // Trigger validation
                    validateFunction();
                }
            }
        })
        .catch(error => {
            console.error('Error loading function syntax:', error);
            const resultsDiv = document.getElementById('validationResults');
            resultsDiv.innerHTML = `<p class="error">Error loading function definitions. Please check console or try again later.</p>`;
            resultsDiv.style.display = 'block';
        });

    const inputElement = document.getElementById('functionInput');
    if (inputElement) {
        inputElement.addEventListener('input', validateFunction);
    } else {
        console.error("Element with ID 'functionInput' not found.");
    }
});

function findAllFunctionOccurrences(input) {
    const occurrences = [];
    const allFunctions = [];
    const functionRegex = /(_{1,3})(\w+)\s*\(/g;
    let match;

    while ((match = functionRegex.exec(input)) !== null) {
        const prefix = match[1];
        const funcName = match[2];
        const canonicalName = `_${funcName}`;

        if (validFunctionNames.includes(canonicalName) && functionSyntax.hasOwnProperty(canonicalName)) {
            allFunctions.push({
                name: canonicalName,
                prefix: prefix,
                index: match.index,
                syntax: functionSyntax[canonicalName],
                nestingLevel: null,
                context: null,
                expectedUnderscores: null,
                actualUnderscores: prefix.length
            });
        }
    }

    const dollarBracePositions = [];
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        const nextChar = input[i+1] || '';

        if ((char === "'" || char === '"') && (i === 0 || input[i-1] !== '\\')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }

        if (char === '$' && nextChar === '{') {
            dollarBracePositions.push(i);
        }
    }

    allFunctions.forEach(func => {
        let nestingLevel = 0;

        for (const dollarBracePos of dollarBracePositions) {
            if (dollarBracePos < func.index) {
                nestingLevel++;
            }
        }

        if (nestingLevel > 0) {
            nestingLevel--;
        }

        const context = nestingLevel > 0 ? 'brace' : 'standalone';
        const expectedUnderscores = nestingLevel + 1;
        func.nestingLevel = nestingLevel;
        func.context = context;
        func.expectedUnderscores = expectedUnderscores;
        occurrences.push(func);
    });

    let stack = [];
    let nestingLevels = new Map();

    inString = false;
    stringChar = '';
    let currentLevel = 0;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        const nextChar = input[i+1] || '';

        if ((char === "'" || char === '"') && (i === 0 || input[i-1] !== '\\')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }

        if (char === '$' && nextChar === '{') {
            currentLevel++;
            stack.push(i);
        } else if (char === '}' && stack.length > 0) {
            const openPosition = stack.pop();
            const closedSection = input.substring(openPosition, i + 1);
            nestingLevels.set([openPosition, i], currentLevel - 1);
            currentLevel--;
        }
    }

    occurrences.forEach(func => {
        let functionLevel = 0;
        let smallestSectionSize = Infinity;

        for (const [[start, end], level] of nestingLevels.entries()) {
            if (func.index > start && func.index < end) {
                const sectionSize = end - start;
                if (sectionSize < smallestSectionSize) {
                    smallestSectionSize = sectionSize;
                    functionLevel = level;
                }
            }
        }

        func.nestingLevel = functionLevel;
        func.expectedUnderscores = functionLevel + 1;
    });

    if (occurrences.length > 0) {
        const outermostFunc = occurrences.find(f => f.nestingLevel === 0);
        if (outermostFunc) {
            const outerFuncStart = input.indexOf('(', outermostFunc.index);
            const outerFuncEnd = findMatchingClosingBracket(input, outerFuncStart);
            if (outerFuncStart !== -1 && outerFuncEnd !== -1) {
                const paramsStr = input.substring(outerFuncStart + 1, outerFuncEnd);
                const paramPositions = splitByCommas(paramsStr);
                paramPositions.forEach((paramRange, paramIndex) => {
                    const paramStart = outerFuncStart + 1 + paramRange[0];
                    const paramEnd = outerFuncStart + 1 + paramRange[1];
                    occurrences.forEach(func => {
                        if (func.index > paramStart && func.index < paramEnd) {
                            let levelInParam = 0;
                            let inParamString = false;
                            let paramStringChar = '';
                            for (let i = paramStart; i < func.index; i++) {
                                const char = input[i];
                                const nextChar = input[i+1] || '';
                                if ((char === "'" || char === '"') && (i === 0 || input[i-1] !== '\\')) {
                                    if (!inParamString) {
                                        inParamString = true;
                                        paramStringChar = char;
                                    } else if (char === paramStringChar) {
                                        inParamString = false;
                                    }
                                }
                                if (char === '$' && nextChar === '{') {
                                    levelInParam++;
                                }
                            }
                            if (levelInParam === 1) {
                                func.nestingLevel = 1;
                                func.expectedUnderscores = 2;
                            }
                        }
                    });
                });
            }
        }
    }

    function findMatchingClosingBracket(str, openPos) {
        let depth = 1;
        for (let i = openPos + 1; i < str.length; i++) {
            if (str[i] === '(') depth++;
            else if (str[i] === ')') {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    }

    function splitByCommas(str) {
        const positions = [];
        let start = 0;
        let depth = 0;
        let inParamString = false;
        let paramStringChar = '';
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if ((char === "'" || char === '"') && (i === 0 || str[i-1] !== '\\')) {
                if (!inParamString) {
                    inParamString = true;
                    paramStringChar = char;
                } else if (char === paramStringChar) {
                    inParamString = false;
                }
            }
            if (!inParamString) {
                if (char === '(' || char === '[' || char === '{') {
                    depth++;
                } else if (char === ')' || char === ']' || char === '}') {
                    depth--;
                } else if (char === ',' && depth === 0) {
                    positions.push([start, i]);
                    start = i + 1;
                }
            }
        }
        if (start < str.length) {
            positions.push([start, str.length]);
        }
        return positions;
    }

    return occurrences;
}

function checkBalance(str) {
    const stack = [];
    const open = ['(', '{', '['];
    const close = [')', '}', ']'];
    const map = { ')': '(', '}': '{', ']': '[' };

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (open.includes(char)) {
            stack.push({ char: char, index: i });
        } else if (close.includes(char)) {
            if (stack.length === 0) {
                return { balanced: false, type: char, index: i };
            }
            const lastOpen = stack.pop();
            if (map[char] !== lastOpen.char) {
                return { balanced: false, type: 'mismatch', expected: map[char], found: char, index: i };
            }
        }
    }

    if (stack.length > 0) {
        const lastUnclosed = stack[stack.length - 1];
        return { balanced: false, type: 'unclosed', expected: Object.keys(map).find(key => map[key] === lastUnclosed.char), found: 'end of input', index: lastUnclosed.index };
    }

    return { balanced: true };
}

function checkQuotesBalance(str) {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let singleQuoteStart = -1;
    let doubleQuoteStart = -1;
    
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const prevChar = i > 0 ? str[i-1] : '';
        
        // Skip escaped quotes
        if (prevChar === '\\') {
            continue;
        }
        
        if (char === "'" && !inDoubleQuote) {
            if (inSingleQuote) {
                inSingleQuote = false;
            } else {
                inSingleQuote = true;
                singleQuoteStart = i;
            }
        } else if (char === '"' && !inSingleQuote) {
            if (inDoubleQuote) {
                inDoubleQuote = false;
            } else {
                inDoubleQuote = true;
                doubleQuoteStart = i;
            }
        }
    }
    
    if (inSingleQuote) {
        return { balanced: false, type: 'unclosed', quoteType: 'single', index: singleQuoteStart };
    }
    
    if (inDoubleQuote) {
        return { balanced: false, type: 'unclosed', quoteType: 'double', index: doubleQuoteStart };
    }
    
    return { balanced: true };
}

function validateFunction() {
    const input = document.getElementById('functionInput').value;
    const resultsDiv = document.getElementById('validationResults');
    const inputDisplayDiv = document.getElementById('inputDisplayArea');

    resultsDiv.innerHTML = '';
    inputDisplayDiv.innerHTML = '';
    resultsDiv.style.display = 'none';
    inputDisplayDiv.style.display = 'none';

    if (Object.keys(functionSyntax).length === 0) {
        resultsDiv.innerHTML = '<p class="info">Loading function definitions...</p>';
        resultsDiv.style.display = 'block';
        return;
    }

    let messages = [];
    let hasErrors = false;
    let errorIndices = [];
    let validationErrors = [];

    const balanceResult = checkBalance(input);
    if (!balanceResult.balanced) {
        hasErrors = true;
        let errorMsg = '';
        let errorIndex = balanceResult.index;
        if (errorIndex !== undefined) {
            // Add to validation errors for proper highlighting
            validationErrors.push({
                message: `Bracket error at position ${errorIndex}`,
                index: errorIndex,
                length: 1
            });
            errorIndices.push(errorIndex);
        }
        if (balanceResult.type === 'mismatch') {
            errorMsg = `<p class="error">Error: Mismatched bracket. Found '${balanceResult.found}' but expected a match for '${balanceResult.expected}'.</p>`;
        } else if (balanceResult.type === 'unclosed'){
            errorMsg = `<p class="error">Error: Unclosed bracket '${balanceResult.expected}'.</p>`;
        } else {
            errorMsg = `<p class="error">Error: Unexpected closing bracket '${balanceResult.type}'.</p>`;
        }
        messages.push(errorMsg);
    } else {
        messages.push('<p class="success">Brackets and Parentheses are balanced.</p>');
    }
    
    // Check for balanced quotes
    const quotesResult = checkQuotesBalance(input);
    if (!quotesResult.balanced) {
        hasErrors = true;
        let errorMsg = '';
        let errorIndex = quotesResult.index;
        if (errorIndex !== undefined) {
            // Add to validation errors for proper highlighting
            validationErrors.push({
                message: `Quote error at position ${errorIndex}`,
                index: errorIndex,
                length: 1
            });
            errorIndices.push(errorIndex);
        }
        if (quotesResult.quoteType === 'single') {
            errorMsg = `<p class="error">Error: Unclosed single quote (') starting at position ${errorIndex}.</p>`;
        } else {
            errorMsg = `<p class="error">Error: Unclosed double quote (") starting at position ${errorIndex}.</p>`;
        }
        messages.push(errorMsg);
    } else {
        messages.push('<p class="success">Quotes are balanced.</p>');
    }

    const allDetectedFunctions = findAllFunctionOccurrences(input);
    const uniqueFunctionNames = [...new Set(allDetectedFunctions.map(f => f.name))];

    allDetectedFunctions.forEach(func => {
        if (func.context === 'brace' && func.actualUnderscores !== func.expectedUnderscores) {
            validationErrors.push({
                message: `Validation Error: Function ${func.name} at nesting level ${func.nestingLevel} should have ${func.expectedUnderscores} underscore(s) but has ${func.actualUnderscores}.`,
                index: func.index,
                length: func.name.length + func.actualUnderscores
            });
            errorIndices.push(func.index);
            hasErrors = true;
        }
    });

    // Check for function calls without underscores inside ${...}
    const missingUnderscoreRegex = /\$\{\s*([a-zA-Z][\w]*)\s*\(/g;
    let missingMatch;

    while ((missingMatch = missingUnderscoreRegex.exec(input)) !== null) {
        // Only validate if there's a function call with parenthesis
        if (missingMatch[1] && missingMatch[1] !== '}') {
            validationErrors.push({
                message: `Validation Error: Missing underscore before function name '${missingMatch[1]}'. Function calls inside \${...} must start with underscores.`,
                index: missingMatch.index + 2,
                length: missingMatch[1].length
            });
            errorIndices.push(missingMatch.index + 2);
            hasErrors = true;
        }
    }
    
    // Check for invalid function names
    const invalidFunctionRegex = /\$\{\s*(_{1,3})(\w+)\s*\(/g;
    let invalidMatch;
    
    while ((invalidMatch = invalidFunctionRegex.exec(input)) !== null) {
        const prefix = invalidMatch[1];
        const funcName = invalidMatch[2];
        const canonicalName = `_${funcName}`;
        
        // Check if this is a valid function name
        if (!validFunctionNames.includes(canonicalName)) {
            validationErrors.push({
                message: `Validation Error: Invalid function name '${prefix}${funcName}' at index ${invalidMatch.index + 2}. This is not a recognized function.`,
                index: invalidMatch.index + 2 + prefix.length,
                length: funcName.length
            });
            errorIndices.push(invalidMatch.index + 2 + prefix.length);
            hasErrors = true;
        }
    }
    
    // Check for functions with more than 3 underscores
    const tooManyUnderscoresRegex = /\$\{\s*(_{4,})(\w+)\s*\(/g;
    let tooManyMatch;
    
    while ((tooManyMatch = tooManyUnderscoresRegex.exec(input)) !== null) {
        const prefix = tooManyMatch[1];
        const funcName = tooManyMatch[2];
        
        validationErrors.push({
            message: `Validation Error: Too many underscores in '${prefix}${funcName}' at index ${tooManyMatch.index + 2}. Maximum allowed is 3 underscores.`,
            index: tooManyMatch.index + 2,
            length: prefix.length
        });
        errorIndices.push(tooManyMatch.index + 2);
        hasErrors = true;
    }

    if (validationErrors.length > 0) {
        messages.push('<h4>Validation Errors:</h4>');
        validationErrors.forEach(error => {
            messages.push(`<p class="error">${error.message}</p>`);
        });
    }

    if (uniqueFunctionNames.length > 0) {
        messages.push('<h4>Detected Functions & Syntax Help:</h4>');
        messages.push('<table class="function-table">');
        messages.push('<tr><th>Function</th><th>Syntax</th></tr>');
        uniqueFunctionNames.forEach(funcName => {
            const funcData = allDetectedFunctions.find(f => f.name === funcName);
            if (funcData) {
                const escapedSyntax = funcData.syntax.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                messages.push(`<tr><td><strong>${funcName}</strong></td><td><code>${escapedSyntax}</code></td></tr>`);
            }
        });
        messages.push('</table>');
    } else if (!hasErrors && validationErrors.length === 0 && input.trim().length > 0) {
        messages.push('<p class="info">No specific functions detected in the input.</p>');
    }

    if (input.trim().length > 0) {
        if (validationErrors.length > 0) {
            // Sort errors by their position in the input
            validationErrors.sort((a, b) => a.index - b.index);
            
            let lastIdx = 0;
            let displayStr = '';
            
            // Apply highlighting to each error section
            validationErrors.forEach(error => {
                if (error.index >= 0 && error.index < input.length) {
                    // Add text before the error
                    displayStr += input.substring(lastIdx, error.index);
                    
                    // Add the error with highlighting
                    const errorText = input.substring(error.index, error.index + error.length);
                    displayStr += `<span class="highlight-error">${errorText}</span>`;
                    
                    // Update the last index
                    lastIdx = error.index + error.length;
                }
            });
            
            // Add any remaining text after the last error
            displayStr += input.substring(lastIdx);
            
            inputDisplayDiv.innerHTML = displayStr;
            inputDisplayDiv.className = '';
        } else {
            inputDisplayDiv.innerHTML = input;
            inputDisplayDiv.className = 'highlight-success';
        }
        inputDisplayDiv.style.display = 'block';
    }

    if (messages.length > 0) {
        // Add a Fix button if there are errors
        if (hasErrors) {
            messages.push('<div class="button-group">');
            messages.push('<button id="fixErrorBtn" class="fix-btn">Fix in Function Fixer</button>');
            messages.push('</div>');
        }
        
        resultsDiv.innerHTML = messages.join('');
        resultsDiv.style.display = 'block';
        
        // Add event listener for the fix button if it exists
        const fixBtn = document.getElementById('fixErrorBtn');
        if (fixBtn) {
            fixBtn.addEventListener('click', () => {
                const functionText = document.getElementById('functionInput').value;
                
                // Collect error messages
                const errorMessages = validationErrors.map(error => error.message).join('\n');
                
                // Redirect to the fix page with the function and error messages
                window.location.href = `fix.html?function=${encodeURIComponent(functionText)}&errors=${encodeURIComponent(errorMessages)}`;
            });
        }
    }
}
