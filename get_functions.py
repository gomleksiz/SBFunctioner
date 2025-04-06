import requests
from bs4 import BeautifulSoup
import re

def extract_function_syntax_from_tables(url):
    """
    Extracts function names and their syntax information from tables in the documentation URL.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching URL {url}: {e}")
        return {}

    soup = BeautifulSoup(response.text, 'html.parser')
    syntax_info = {}

    # Find all tables
    tables = soup.find_all('table')
    
    for table in tables:
        function_name = None
        syntax_text = None
        
        # Look for rows in the table
        rows = table.find_all('tr')
        
        for row in rows:
            # Look for cells in each row
            cells = row.find_all(['th', 'td'])
            if len(cells) < 2:
                continue
                
            # Check if this row contains the syntax
            header_cell = cells[0].get_text(strip=True).lower()
            if 'syntax' in header_cell:
                # The second cell should contain the syntax
                content_cell = cells[1]
                
                # Look for code or pre tags within the cell
                code_tag = content_cell.find('code')
                pre_tag = content_cell.find('pre')
                
                if code_tag:
                    syntax_text = code_tag.get_text(strip=True)
                elif pre_tag:
                    syntax_text = pre_tag.get_text(strip=True)
                else:
                    syntax_text = content_cell.get_text(strip=True)
                
                # Extract function name from syntax if possible
                if syntax_text and '${' in syntax_text:
                    match = re.search(r'\${(?:__|___)?(\w+)\(', syntax_text)
                    if match:
                        function_name = match.group(1)
        
        if function_name and syntax_text:
            syntax_info[function_name] = re.sub(r'\s+', ' ', syntax_text).strip()
    
    return syntax_info

# Keep the original extract_examples and extract_function_names functions
def extract_examples(url):
    response = requests.get(url)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'html.parser')

    examples = []
    for example in soup.find_all(['pre', 'code']):
        text = example.get_text()
        lines_with_dollar_brace = [line for line in text.splitlines() if '${' in line]
        examples.extend(lines_with_dollar_brace)

    return examples

def extract_function_names(lines):
    function_names = set()
    function_pattern = re.compile(r'\${(?:__+)?(\w+)\(')

    for line in lines:
        matches = function_pattern.findall(line)
        function_names.update(matches)

    return list(function_names)

if __name__ == "__main__":
    url = "https://stonebranchdocs.atlassian.net/wiki/spaces/UC78/pages/1086478062/Functions"
    
    print("--- Extracting Syntax Information from Tables ---")
    syntax_data = extract_function_syntax_from_tables(url)
    if syntax_data:
        for func, syntax in syntax_data.items():
            print(f"Function: {func}\nSyntax:   {syntax}\n")
    else:
        print("Could not extract syntax information from tables.")

    print("\n--- Extracting Examples Containing '${' ---")
    examples = extract_examples(url) 
    function_names = extract_function_names(examples) 
    print("Extracted Function Names:")
    for name in function_names:
        print(name)