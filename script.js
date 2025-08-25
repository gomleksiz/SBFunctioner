let functionSyntax = {};
let functionExamples = {};
let validFunctionNames = [];
let editorView = null;
let lastDetectedFunctions = [];
let lastValidationResult = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for CodeMirror to be available
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    function waitForCodeMirror() {
        attempts++;
        if (typeof window.CodeMirror !== 'undefined' && window.CodeMirror !== null && window.CodeMirror.EditorView) {
            console.log('CodeMirror available, initializing...');
            initializeCodeMirror();
        } else if (window.CodeMirror === null) {
            console.log('CodeMirror loading failed, using fallback');
            initializeFallback();
        } else if (attempts < maxAttempts) {
            setTimeout(waitForCodeMirror, 100);
        } else {
            console.error('CodeMirror failed to load, falling back to textarea');
            initializeFallback();
        }
    }
    
    waitForCodeMirror();
});

function initializeCodeMirror() {
    // First, check if there's a function parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const functionParam = urlParams.get('function');
    
    const { EditorView, EditorState, minimalSetup } = window.CodeMirror;
    
    // Create the editor state
    const initialDoc = functionParam || '';
    
    try {
        editorView = new EditorView({
            state: EditorState.create({
                doc: initialDoc,
                extensions: [
                    ...minimalSetup,
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            validateFunction();
                            updateInlineHighlights();
                        }
                    })
                ]
            }),
            parent: document.getElementById('functionInput')
        });
    } catch (error) {
        console.error('CodeMirror initialization failed:', error);
        initializeFallback();
        return;
    }
    
    if (functionParam) {
        console.log("Function parameter found in URL:", functionParam);
        console.log("Function parameter set in CodeMirror editor");
    }
    
    // Load function definitions
    loadFunctionDefinitions(functionParam);
}

function initializeFallback() {
    // Fallback to textarea if CodeMirror fails to load
    const urlParams = new URLSearchParams(window.location.search);
    const functionParam = urlParams.get('function');
    
    const container = document.getElementById('functionInput');
    container.innerHTML = `<textarea id="fallbackTextarea" placeholder="Enter function string here..." style="width: 100%; min-height: 80px; max-height: 120px; padding: 1rem; font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace; font-size: 18px; border: 2px solid transparent; border-radius: 12px; background: rgba(255, 255, 255, 0.9); resize: none;">${functionParam || ''}</textarea>`;
    
    const textarea = document.getElementById('fallbackTextarea');
    textarea.addEventListener('input', () => {
        validateFunction();
    });
    
    // Override the editor getter for fallback
    window.getEditorValue = () => textarea.value;
    
    // Load function definitions
    loadFunctionDefinitions(functionParam);
}

function loadFunctionDefinitions(functionParam) {
    // Load both function syntax and examples
    Promise.all([
        fetch('functions.json').then(response => response.json()),
        fetch('examples.json').then(response => response.json())
    ])
    .then(([syntaxData, examplesData]) => {
        functionSyntax = syntaxData;
        functionExamples = examplesData;
        validFunctionNames = Object.keys(functionSyntax);
        console.log("Function syntax and examples loaded successfully.");
        
        // Create available functions list in sidebar
        createAvailableFunctionsList();
        
        // Now trigger validation if we had a function parameter
        if (functionParam) {
            console.log("Triggering validation for URL parameter");
            validateFunction();
            updateInlineHighlights();
        }
    })
    .catch(error => {
        console.error('Error loading function definitions:', error);
        const errorsPanel = document.getElementById('validationErrors');
        if (errorsPanel) {
            errorsPanel.innerHTML = `<p class="error">Error loading function definitions. Please check console or try again later.</p>`;
        }
    });
}

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
    let input = '';
    
    if (editorView) {
        input = editorView.state.doc.toString();
    } else if (window.getEditorValue) {
        input = window.getEditorValue();
    } else {
        return; // No editor available
    }
    const errorsPanel = document.getElementById('validationErrors');
    const functionsPanel = document.getElementById('detectedFunctions');
    const inputDisplayDiv = document.getElementById('inputDisplayArea');

    // Clear error panel and input display (these always need updating)
    errorsPanel.innerHTML = '';
    inputDisplayDiv.innerHTML = '';
    inputDisplayDiv.style.display = 'none';

    if (Object.keys(functionSyntax).length === 0) {
        errorsPanel.innerHTML = '<p class="info">Loading function definitions...</p>';
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
    
    // Check if detected functions have changed
    const functionsChanged = JSON.stringify(uniqueFunctionNames) !== JSON.stringify(lastDetectedFunctions);

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
        messages.push('<tr><th>Function</th><th>Syntax</th><th>Examples</th></tr>');
        uniqueFunctionNames.forEach(funcName => {
            const funcData = allDetectedFunctions.find(f => f.name === funcName);
            if (funcData) {
                const escapedSyntax = funcData.syntax.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                
                // Get examples for this function
                const exampleString = functionExamples[funcName];
                let exampleHtml = '<span class="no-examples">No examples available</span>';
                
                if (exampleString && typeof exampleString === 'string') {
                    // Split examples - they're separated by various patterns like } → or → 
                    const examples = exampleString.split(/(?=\${)|(?<=\})\s*(?=\${)/).filter(ex => ex.trim().length > 0);
                    
                    if (examples.length > 0) {
                        // Show all examples without spaces between them
                        const allExamples = examples.map(ex => ex.replace(/</g, "&lt;").replace(/>/g, "&gt;")).join('<br>');
                        exampleHtml = `<code class="example">${allExamples}</code>`;
                    }
                }
                
                messages.push(`<tr><td><strong>${funcName}</strong></td><td><code>${escapedSyntax}</code></td><td>${exampleHtml}</td></tr>`);
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
            
            // Add floating fix button if we're not on fix page
            if (!window.location.pathname.includes('fix.html')) {
                if (hasErrors) {
                    displayStr += '<button id="fixErrorBtn" class="fix-btn floating-fix-btn">Fix Function →</button>';
                } else {
                    displayStr += '<button id="fixErrorBtn" class="fix-btn floating-fix-btn" disabled>Fix Function →</button>';
                }
            }
            
            inputDisplayDiv.innerHTML = displayStr;
            inputDisplayDiv.className = '';
        } else {
            let successDisplayStr = input;
            // Add floating disabled fix button when no errors
            if (!window.location.pathname.includes('fix.html')) {
                successDisplayStr += '<button id="fixErrorBtn" class="fix-btn floating-fix-btn" disabled>Fix Function →</button>';
            }
            inputDisplayDiv.innerHTML = successDisplayStr;
            inputDisplayDiv.className = 'highlight-success';
        }
        inputDisplayDiv.style.display = 'block';
        
        // Add event listener for the fix button if it exists in the preview area
        const fixBtn = document.getElementById('fixErrorBtn');
        if (fixBtn && !fixBtn.disabled) {
            fixBtn.addEventListener('click', () => {
                let functionText = '';
                if (editorView) {
                    functionText = editorView.state.doc.toString();
                } else if (window.getEditorValue) {
                    functionText = window.getEditorValue();
                }
                
                // Collect error messages
                const errorMessages = validationErrors.map(error => error.message).join('\n');
                
                // Redirect to the fix page with the function and error messages
                window.location.href = `fix.html?function=${encodeURIComponent(functionText)}&errors=${encodeURIComponent(errorMessages)}`;
            });
        }
    }

    if (messages.length > 0) {
        // Fix button will be added directly to preview area
        
        // Split messages into errors and functions
        const errorMessages = [];
        const functionMessages = [];
        let currentSection = 'error';
        
        messages.forEach(msg => {
            if (msg.includes('Detected Functions')) {
                currentSection = 'function';
                functionMessages.push('<h4>Detected Functions</h4>');
            } else if (msg.includes('Validation Errors')) {
                currentSection = 'error';
                errorMessages.push('<h4>Validation Status</h4>');
            } else if (currentSection === 'function') {
                functionMessages.push(msg);
            } else {
                errorMessages.push(msg);
            }
        });
        
        // If no specific headers were found, treat as mixed content
        if (errorMessages.length === 0 && functionMessages.length === 0) {
            errorMessages.push('<h4>Validation Status</h4>');
            errorMessages.push(...messages);
        }
        
        // Display error messages (without fix button)
        let errorHtml = errorMessages.length > 0 ? errorMessages.join('') : '<h4>Validation Status</h4><p class="info">Enter a function to validate</p>';
        errorsPanel.innerHTML = errorHtml;
        
        // Only update functions panel if functions have changed
        if (functionsChanged) {
            functionsPanel.innerHTML = functionMessages.length > 0 ? functionMessages.join('') : '<h4>Detected Functions</h4><p class="info">No functions detected</p>';
            lastDetectedFunctions = [...uniqueFunctionNames];
        }
        
        // Update inline highlights
        updateInlineHighlights();
        
    } else {
        // Handle case where no messages but functions might have changed
        if (functionsChanged) {
            functionsPanel.innerHTML = '<h4>Detected Functions</h4><p class="info">No functions detected</p>';
            lastDetectedFunctions = [...uniqueFunctionNames];
        }
    }
}


// Function to create the available functions list in sidebar
function createAvailableFunctionsList() {
    const functionsDiv = document.getElementById('availableFunctions');
    if (!functionsDiv || !functionSyntax) return;

    // Sort functions alphabetically for better organization
    const sortedFunctions = Object.keys(functionSyntax).sort();
    
    let html = '';
    sortedFunctions.forEach(funcName => {
        const syntax = functionSyntax[funcName].syntax || funcName + '()';
        const exampleString = functionExamples[funcName];
        let tooltip = syntax;
        
        if (exampleString && typeof exampleString === 'string') {
            // Split examples and take first few for tooltip
            const examples = exampleString.split(/(?=\${)|(?<=\})\s*(?=\${)/).filter(ex => ex.trim().length > 0);
            if (examples.length > 0) {
                tooltip += '\n\nExamples:\n' + examples.slice(0, 2).join('\n');
                if (examples.length > 2) {
                    tooltip += `\n... and ${examples.length - 2} more`;
                }
            }
        }
        
        html += `<div class="function-item" title="${tooltip.replace(/"/g, '&quot;')}">${funcName}</div>`;
    });
    
    functionsDiv.innerHTML = html;
    
    // Add click handlers to insert function names
    functionsDiv.querySelectorAll('.function-item').forEach(item => {
        item.addEventListener('click', () => {
            const functionName = item.textContent;
            const insertText = '${' + functionName + '(';
            
            if (editorView) {
                // CodeMirror mode
                const selection = editorView.state.selection.main;
                editorView.dispatch({
                    changes: {
                        from: selection.from,
                        to: selection.to,
                        insert: insertText
                    },
                    selection: {
                        anchor: selection.from + insertText.length
                    }
                });
                editorView.focus();
            } else {
                // Fallback textarea mode
                const textarea = document.getElementById('fallbackTextarea');
                if (textarea) {
                    const cursorPos = textarea.selectionStart;
                    const currentValue = textarea.value;
                    const newValue = currentValue.slice(0, cursorPos) + insertText + currentValue.slice(cursorPos);
                    textarea.value = newValue;
                    textarea.focus();
                    textarea.setSelectionRange(cursorPos + insertText.length, cursorPos + insertText.length);
                }
            }
            
            // Trigger validation
            validateFunction();
        });
    });
    
    // Add search functionality
    const searchInput = document.getElementById('functionSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const functionItems = functionsDiv.querySelectorAll('.function-item');
            
            functionItems.forEach(item => {
                const functionName = item.textContent.toLowerCase();
                if (functionName.includes(searchTerm)) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        });
    }
}

// Function to update inline highlights in CodeMirror
function updateInlineHighlights() {
    if (!editorView) return;
    
    const input = editorView.state.doc.toString();
    
    if (!input.trim()) {
        return;
    }

    // Get current validation errors from the main validation function
    const validationErrors = [];
    
    // Check brackets
    const balanceResult = checkBalance(input);
    if (!balanceResult.balanced && balanceResult.index !== undefined) {
        validationErrors.push({
            start: balanceResult.index,
            end: balanceResult.index + 1,
            type: 'bracket'
        });
    }

    // Check quotes
    const quoteResult = checkQuotesBalance(input);
    if (!quoteResult.balanced && quoteResult.index !== undefined) {
        validationErrors.push({
            start: quoteResult.index,
            end: quoteResult.index + 1,
            type: 'quote'
        });
    }

    // Check function underscore errors using the actual validation logic
    const allDetectedFunctions = findAllFunctionOccurrences(input);
    allDetectedFunctions.forEach(func => {
        if (func.context === 'brace' && func.actualUnderscores !== func.expectedUnderscores) {
            validationErrors.push({
                start: func.index,
                end: func.index + func.name.length + func.actualUnderscores,
                type: 'underscore'
            });
        }
    });

    // Check for function calls without underscores inside ${...}
    const missingUnderscoreRegex = /\$\{\s*([a-zA-Z][\w]*)\s*\(/g;
    let missingMatch;
    while ((missingMatch = missingUnderscoreRegex.exec(input)) !== null) {
        if (missingMatch[1] && missingMatch[1] !== '}') {
            validationErrors.push({
                start: missingMatch.index + 2,
                end: missingMatch.index + 2 + missingMatch[1].length,
                type: 'missing_underscore'
            });
        }
    }

    // Check for invalid function names
    const invalidFunctionRegex = /\$\{\s*(_{1,3})(\w+)\s*\(/g;
    let invalidMatch;
    while ((invalidMatch = invalidFunctionRegex.exec(input)) !== null) {
        const prefix = invalidMatch[1];
        const funcName = invalidMatch[2];
        const canonicalName = `_${funcName}`;
        
        if (!validFunctionNames.includes(canonicalName)) {
            validationErrors.push({
                start: invalidMatch.index + 2 + prefix.length,
                end: invalidMatch.index + 2 + prefix.length + funcName.length,
                type: 'invalid_function'
            });
        }
    }

    // Apply CodeMirror decorations for errors
    if (window.CodeMirror && window.CodeMirror.Decoration) {
        const { Decoration } = window.CodeMirror;
        const decorations = [];
        
        validationErrors.forEach(error => {
            const decoration = Decoration.mark({
                class: 'cm-error-highlight',
                attributes: { title: `Error: ${error.type}` }
            }).range(error.start, error.end);
            decorations.push(decoration);
        });
        
        // If no errors, highlight valid functions with success
        if (validationErrors.length === 0) {
            const functionMatches = input.matchAll(/(_+)([a-zA-Z_]\w*)/g);
            for (const match of functionMatches) {
                const funcName = '_' + match[2];
                if (validFunctionNames.includes(funcName)) {
                    const decoration = Decoration.mark({
                        class: 'cm-success-highlight'
                    }).range(match.index, match.index + match[0].length);
                    decorations.push(decoration);
                }
            }
        }
        
        // Apply decorations using a state effect (simplified approach)
        try {
            editorView.dispatch({
                effects: [
                    // Clear existing decorations and add new ones
                    // This is a simplified approach - in a real implementation you'd use StateField
                ]
            });
        } catch (e) {
            console.log('Decoration application not yet fully implemented:', e);
        }
    }
}

// Function to sync scroll position - no longer needed with CodeMirror
function syncScrollPosition() {
    // CodeMirror handles scrolling internally
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
