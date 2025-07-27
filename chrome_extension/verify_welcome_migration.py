import json
import re

# Define the absolute paths for the files
welcome_html_path = 'F:/George/OneDrive - CIDE/Documentos/Proyectos personales/Quanum Highlighter PRO/Quantum Highlighter PRO/chrome_extension/welcome.html'
messages_json_path = 'F:/George/OneDrive - CIDE/Documentos/Proyectos personales/Quanum Highlighter PRO/Quantum Highlighter PRO/chrome_extension/_locales/en/messages.json'

# Read the welcome.html file
with open(welcome_html_path, 'r', encoding='utf-8') as f:
    welcome_html_content = f.read()

# Extract the old translations object using regex
translations_str_match = re.search(r'const translations = ({.*?});', welcome_html_content, re.DOTALL)

if translations_str_match:
    translations_str = translations_str_match.group(1)
    # A simple (and fragile) way to convert the JS object to a JSON string
    json_str = re.sub(r'(\w+):', r'"\1":', translations_str)
    json_str = json_str.replace("'", '"')
    
    try:
        old_translations = json.loads(json_str)
        old_keys = set(old_translations['en'].keys())

        # Read the messages.json file
        with open(messages_json_path, 'r', encoding='utf-8') as f:
            messages_json = json.load(f)
        messages_keys = set(messages_json.keys())

        # Find missing keys
        missing_keys = old_keys - messages_keys

        print("--- Verifying migration of keys from welcome.html to en/messages.json ---")
        if missing_keys:
            print(f"Missing keys in en/messages.json: {sorted(list(missing_keys))}")
        else:
            print("All keys from welcome.html have been successfully migrated.")
        print("--- Verification Complete ---")

    except json.JSONDecodeError as e:
        print(f"Error parsing JSON from welcome.html: {e}")
    except KeyError:
        print("Error: Could not find 'en' key in the old translations object.")
else:
    print("Could not find the old 'translations' object in welcome.html. It might have been removed already.")
