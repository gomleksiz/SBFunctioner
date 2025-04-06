import json
import re

def parse_functions_to_json(input_txt_file, output_json_file):
    """
    Reads the functions.txt file, parses function names and syntax,
    and writes the data to a JSON file.
    """
    functions_data = {}
    function_name = None
    
    try:
        with open(input_txt_file, 'r') as infile:
            for line in infile:
                line = line.strip()
                if line.startswith("Function:"):
                    # Extract function name (e.g., _ifEqual)
                    match = re.search(r"Function:\s*(_\w+)", line)
                    if match:
                        function_name = match.group(1)
                elif line.startswith("Syntax:") and function_name:
                    # Extract syntax string, removing the "Syntax:" prefix and leading/trailing whitespace
                    syntax = line.replace("Syntax:", "").strip()
                    # Handle potential missing closing brackets/parentheses based on observation
                    if function_name in ['_random', '_siblingid', '_varLookup'] and not syntax.endswith(')'):
                        syntax += ')' # Add missing closing parenthesis
                        
                    functions_data[function_name] = syntax
                    function_name = None # Reset for the next function block
                    
    except FileNotFoundError:
        print(f"Error: Input file '{input_txt_file}' not found.")
        return
    except Exception as e:
        print(f"An error occurred during parsing: {e}")
        return

    try:
        with open(output_json_file, 'w') as outfile:
            json.dump(functions_data, outfile, indent=4)
        print(f"Successfully created '{output_json_file}' with {len(functions_data)} functions.")
    except Exception as e:
        print(f"An error occurred while writing the JSON file: {e}")

if __name__ == "__main__":
    input_file = "functions.txt"
    output_file = "functions.json"
    parse_functions_to_json(input_file, output_file)
