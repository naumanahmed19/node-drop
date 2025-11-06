/**
 * Text Parser Node - Comprehensive string operations
 * Provides lodash-like string utilities for workflow automation
 */

const TextParserNode = {
    type: "textParser",
    displayName: "Text Parser",
    name: "textParser",
    group: ["transform"],
    version: 1,
    description: "Transform and manipulate strings with various operations",
    icon: "file:icon.svg",
    color: "#9C27B0",
    defaults: {
        name: "Text Parser",
    },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
        {
            displayName: "Operation",
            name: "operation",
            type: "options",
            default: "toUpperCase",
            required: true,
            options: [
                // Case Transformations
                {
                    name: "To Uppercase",
                    value: "toUpperCase",
                    description: "Convert string to UPPERCASE",
                },
                {
                    name: "To Lowercase",
                    value: "toLowerCase",
                    description: "Convert string to lowercase",
                },
                {
                    name: "To Title Case",
                    value: "toTitleCase",
                    description: "Convert String To Title Case",
                },
                {
                    name: "To Camel Case",
                    value: "toCamelCase",
                    description: "Convert string to camelCase",
                },
                {
                    name: "To Snake Case",
                    value: "toSnakeCase",
                    description: "Convert string to snake_case",
                },
                {
                    name: "To Kebab Case",
                    value: "toKebabCase",
                    description: "Convert string to kebab-case",
                },
                {
                    name: "Capitalize",
                    value: "capitalize",
                    description: "Capitalize first letter only",
                },

                // Trimming & Padding
                {
                    name: "Trim",
                    value: "trim",
                    description: "Remove whitespace from both ends",
                },
                {
                    name: "Trim Start",
                    value: "trimStart",
                    description: "Remove whitespace from start",
                },
                {
                    name: "Trim End",
                    value: "trimEnd",
                    description: "Remove whitespace from end",
                },
                {
                    name: "Pad Start",
                    value: "padStart",
                    description: "Pad string at the start",
                },
                {
                    name: "Pad End",
                    value: "padEnd",
                    description: "Pad string at the end",
                },

                // Replacement & Removal
                {
                    name: "Replace",
                    value: "replace",
                    description: "Replace first occurrence",
                },
                {
                    name: "Replace All",
                    value: "replaceAll",
                    description: "Replace all occurrences",
                },
                {
                    name: "Remove",
                    value: "remove",
                    description: "Remove all occurrences of a substring",
                },
                {
                    name: "Remove Whitespace",
                    value: "removeWhitespace",
                    description: "Remove all whitespace characters",
                },

                // Extraction
                {
                    name: "Substring",
                    value: "substring",
                    description: "Extract substring by position",
                },
                {
                    name: "Slice",
                    value: "slice",
                    description: "Extract slice of string",
                },
                {
                    name: "Extract Between",
                    value: "extractBetween",
                    description: "Extract text between two strings",
                },
                {
                    name: "Truncate",
                    value: "truncate",
                    description: "Truncate string to length",
                },

                // Splitting & Joining
                {
                    name: "Split",
                    value: "split",
                    description: "Split string into array",
                },
                {
                    name: "Join Array",
                    value: "join",
                    description: "Join array into string",
                },

                // Encoding & Decoding
                {
                    name: "URL Encode",
                    value: "urlEncode",
                    description: "Encode string for URL",
                },
                {
                    name: "URL Decode",
                    value: "urlDecode",
                    description: "Decode URL-encoded string",
                },
                {
                    name: "Base64 Encode",
                    value: "base64Encode",
                    description: "Encode string to Base64",
                },
                {
                    name: "Base64 Decode",
                    value: "base64Decode",
                    description: "Decode Base64 string",
                },
                {
                    name: "HTML Encode",
                    value: "htmlEncode",
                    description: "Encode HTML entities",
                },
                {
                    name: "HTML Decode",
                    value: "htmlDecode",
                    description: "Decode HTML entities",
                },

                // Validation & Checking
                {
                    name: "Contains",
                    value: "contains",
                    description: "Check if string contains substring",
                },
                {
                    name: "Starts With",
                    value: "startsWith",
                    description: "Check if string starts with substring",
                },
                {
                    name: "Ends With",
                    value: "endsWith",
                    description: "Check if string ends with substring",
                },
                {
                    name: "Is Empty",
                    value: "isEmpty",
                    description: "Check if string is empty",
                },
                {
                    name: "Length",
                    value: "length",
                    description: "Get string length",
                },

                // Regex Operations
                {
                    name: "Regex Match",
                    value: "regexMatch",
                    description: "Match string against regex pattern",
                },
                {
                    name: "Regex Replace",
                    value: "regexReplace",
                    description: "Replace using regex pattern",
                },
                {
                    name: "Regex Extract",
                    value: "regexExtract",
                    description: "Extract matches from regex",
                },

                // Other Operations
                {
                    name: "Reverse",
                    value: "reverse",
                    description: "Reverse the string",
                },
                {
                    name: "Repeat",
                    value: "repeat",
                    description: "Repeat string N times",
                },
                {
                    name: "Slugify",
                    value: "slugify",
                    description: "Convert to URL-friendly slug",
                },
            ],
            description: "The string operation to perform",
        },

        // Input Field
        {
            displayName: "Input Field",
            name: "inputField",
            type: "string",
            default: "",
            required: true,
            placeholder: "{{json.fieldName}}",
            description: "The field containing the string to manipulate",
        },

        // Output Field
        {
            displayName: "Output Field",
            name: "outputField",
            type: "string",
            default: "result",
            required: true,
            placeholder: "result",
            description: "The field name for the output",
        },

        // Operation-specific parameters
        {
            displayName: "Search Value",
            name: "searchValue",
            type: "string",
            default: "",
            required: true,
            displayOptions: {
                show: {
                    operation: ["replace", "replaceAll", "remove", "contains", "startsWith", "endsWith"],
                },
            },
            description: "The value to search for",
        },
        {
            displayName: "Replace With",
            name: "replaceWith",
            type: "string",
            default: "",
            required: true,
            displayOptions: {
                show: {
                    operation: ["replace", "replaceAll"],
                },
            },
            description: "The replacement value",
        },
        {
            displayName: "Start Position",
            name: "startPosition",
            type: "number",
            default: 0,
            displayOptions: {
                show: {
                    operation: ["substring", "slice"],
                },
            },
            description: "Starting position (0-based index)",
        },
        {
            displayName: "End Position",
            name: "endPosition",
            type: "number",
            default: 10,
            displayOptions: {
                show: {
                    operation: ["substring", "slice"],
                },
            },
            description: "Ending position",
        },
        {
            displayName: "Length",
            name: "length",
            type: "number",
            default: 50,
            displayOptions: {
                show: {
                    operation: ["truncate", "padStart", "padEnd"],
                },
            },
            description: "Target length",
        },
        {
            displayName: "Pad Character",
            name: "padChar",
            type: "string",
            default: " ",
            displayOptions: {
                show: {
                    operation: ["padStart", "padEnd"],
                },
            },
            description: "Character to use for padding",
        },
        {
            displayName: "Separator",
            name: "separator",
            type: "string",
            default: ",",
            displayOptions: {
                show: {
                    operation: ["split", "join"],
                },
            },
            description: "Separator for split/join operation",
        },
        {
            displayName: "Start Delimiter",
            name: "startDelimiter",
            type: "string",
            default: "",
            required: true,
            displayOptions: {
                show: {
                    operation: ["extractBetween"],
                },
            },
            description: "Starting delimiter",
        },
        {
            displayName: "End Delimiter",
            name: "endDelimiter",
            type: "string",
            default: "",
            required: true,
            displayOptions: {
                show: {
                    operation: ["extractBetween"],
                },
            },
            description: "Ending delimiter",
        },
        {
            displayName: "Regex Pattern",
            name: "regexPattern",
            type: "string",
            default: "",
            required: true,
            displayOptions: {
                show: {
                    operation: ["regexMatch", "regexReplace", "regexExtract"],
                },
            },
            description: "Regular expression pattern",
            placeholder: "\\d+",
        },
        {
            displayName: "Regex Flags",
            name: "regexFlags",
            type: "string",
            default: "g",
            displayOptions: {
                show: {
                    operation: ["regexMatch", "regexReplace", "regexExtract"],
                },
            },
            description: "Regex flags (g, i, m, s, u, y)",
            placeholder: "gi",
        },
        {
            displayName: "Replacement",
            name: "regexReplacement",
            type: "string",
            default: "",
            required: true,
            displayOptions: {
                show: {
                    operation: ["regexReplace"],
                },
            },
            description: "Replacement string (can use $1, $2 for capture groups)",
        },
        {
            displayName: "Repeat Count",
            name: "repeatCount",
            type: "number",
            default: 2,
            displayOptions: {
                show: {
                    operation: ["repeat"],
                },
            },
            description: "Number of times to repeat",
        },
        {
            displayName: "Truncate Suffix",
            name: "truncateSuffix",
            type: "string",
            default: "...",
            displayOptions: {
                show: {
                    operation: ["truncate"],
                },
            },
            description: "Suffix to add when truncating",
        },
    ],

    execute: async function (inputData) {
        const items = inputData.main?.[0] || [];
        const itemsToProcess = items.length > 0 ? items : [{ json: {} }];

        const operation = await this.getNodeParameter("operation");
        const inputField = await this.getNodeParameter("inputField");
        const outputField = await this.getNodeParameter("outputField");

        const results = [];

        for (const item of itemsToProcess) {
            try {
                // Get input value
                let inputValue = inputField;

                // If it's an expression like {{json.field}}, evaluate it
                if (typeof inputValue === 'string' && inputValue.includes('{{')) {
                    // Simple expression evaluation - in production, use proper expression parser
                    inputValue = inputValue.replace(/\{\{json\.(\w+)\}\}/g, (match, field) => {
                        return item.json[field] || '';
                    });
                }

                // Convert to string
                inputValue = String(inputValue || '');

                let result;

                switch (operation) {
                    // Case Transformations
                    case "toUpperCase":
                        result = inputValue.toUpperCase();
                        break;
                    case "toLowerCase":
                        result = inputValue.toLowerCase();
                        break;
                    case "toTitleCase":
                        result = inputValue.replace(/\w\S*/g, (txt) =>
                            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
                        );
                        break;
                    case "toCamelCase":
                        result = inputValue
                            .toLowerCase()
                            .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
                        break;
                    case "toSnakeCase":
                        result = inputValue
                            .replace(/\W+/g, ' ')
                            .split(/ |\B(?=[A-Z])/)
                            .map(word => word.toLowerCase())
                            .join('_');
                        break;
                    case "toKebabCase":
                        result = inputValue
                            .replace(/\W+/g, ' ')
                            .split(/ |\B(?=[A-Z])/)
                            .map(word => word.toLowerCase())
                            .join('-');
                        break;
                    case "capitalize":
                        result = inputValue.charAt(0).toUpperCase() + inputValue.slice(1).toLowerCase();
                        break;

                    // Trimming & Padding
                    case "trim":
                        result = inputValue.trim();
                        break;
                    case "trimStart":
                        result = inputValue.trimStart();
                        break;
                    case "trimEnd":
                        result = inputValue.trimEnd();
                        break;
                    case "padStart": {
                        const length = await this.getNodeParameter("length");
                        const padChar = await this.getNodeParameter("padChar");
                        result = inputValue.padStart(length, padChar);
                        break;
                    }
                    case "padEnd": {
                        const length = await this.getNodeParameter("length");
                        const padChar = await this.getNodeParameter("padChar");
                        result = inputValue.padEnd(length, padChar);
                        break;
                    }

                    // Replacement & Removal
                    case "replace": {
                        const searchValue = await this.getNodeParameter("searchValue");
                        const replaceWith = await this.getNodeParameter("replaceWith");
                        result = inputValue.replace(searchValue, replaceWith);
                        break;
                    }
                    case "replaceAll": {
                        const searchValue = await this.getNodeParameter("searchValue");
                        const replaceWith = await this.getNodeParameter("replaceWith");
                        result = inputValue.split(searchValue).join(replaceWith);
                        break;
                    }
                    case "remove": {
                        const searchValue = await this.getNodeParameter("searchValue");
                        result = inputValue.split(searchValue).join('');
                        break;
                    }
                    case "removeWhitespace":
                        result = inputValue.replace(/\s+/g, '');
                        break;

                    // Extraction
                    case "substring": {
                        const start = await this.getNodeParameter("startPosition");
                        const end = await this.getNodeParameter("endPosition");
                        result = inputValue.substring(start, end);
                        break;
                    }
                    case "slice": {
                        const start = await this.getNodeParameter("startPosition");
                        const end = await this.getNodeParameter("endPosition");
                        result = inputValue.slice(start, end);
                        break;
                    }
                    case "extractBetween": {
                        const startDelim = await this.getNodeParameter("startDelimiter");
                        const endDelim = await this.getNodeParameter("endDelimiter");
                        const startIdx = inputValue.indexOf(startDelim);
                        if (startIdx !== -1) {
                            const start = startIdx + startDelim.length;
                            const endIdx = inputValue.indexOf(endDelim, start);
                            result = endIdx !== -1 ? inputValue.substring(start, endIdx) : '';
                        } else {
                            result = '';
                        }
                        break;
                    }
                    case "truncate": {
                        const length = await this.getNodeParameter("length");
                        const suffix = await this.getNodeParameter("truncateSuffix");
                        result = inputValue.length > length
                            ? inputValue.substring(0, length - suffix.length) + suffix
                            : inputValue;
                        break;
                    }

                    // Splitting & Joining
                    case "split": {
                        const separator = await this.getNodeParameter("separator");
                        result = inputValue.split(separator);
                        break;
                    }
                    case "join": {
                        const separator = await this.getNodeParameter("separator");
                        // Assume inputValue is an array or convert it
                        const arr = Array.isArray(inputValue) ? inputValue : [inputValue];
                        result = arr.join(separator);
                        break;
                    }

                    // Encoding & Decoding
                    case "urlEncode":
                        result = encodeURIComponent(inputValue);
                        break;
                    case "urlDecode":
                        result = decodeURIComponent(inputValue);
                        break;
                    case "base64Encode":
                        result = Buffer.from(inputValue).toString('base64');
                        break;
                    case "base64Decode":
                        result = Buffer.from(inputValue, 'base64').toString('utf-8');
                        break;
                    case "htmlEncode":
                        result = inputValue
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;');
                        break;
                    case "htmlDecode":
                        result = inputValue
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'");
                        break;

                    // Validation & Checking
                    case "contains": {
                        const searchValue = await this.getNodeParameter("searchValue");
                        result = inputValue.includes(searchValue);
                        break;
                    }
                    case "startsWith": {
                        const searchValue = await this.getNodeParameter("searchValue");
                        result = inputValue.startsWith(searchValue);
                        break;
                    }
                    case "endsWith": {
                        const searchValue = await this.getNodeParameter("searchValue");
                        result = inputValue.endsWith(searchValue);
                        break;
                    }
                    case "isEmpty":
                        result = inputValue.trim().length === 0;
                        break;
                    case "length":
                        result = inputValue.length;
                        break;

                    // Regex Operations
                    case "regexMatch": {
                        const pattern = await this.getNodeParameter("regexPattern");
                        const flags = await this.getNodeParameter("regexFlags");
                        const regex = new RegExp(pattern, flags);
                        const matches = inputValue.match(regex);
                        result = matches || [];
                        break;
                    }
                    case "regexReplace": {
                        const pattern = await this.getNodeParameter("regexPattern");
                        const flags = await this.getNodeParameter("regexFlags");
                        const replacement = await this.getNodeParameter("regexReplacement");
                        const regex = new RegExp(pattern, flags);
                        result = inputValue.replace(regex, replacement);
                        break;
                    }
                    case "regexExtract": {
                        const pattern = await this.getNodeParameter("regexPattern");
                        const flags = await this.getNodeParameter("regexFlags");
                        const regex = new RegExp(pattern, flags);
                        const matches = [];
                        let match;
                        while ((match = regex.exec(inputValue)) !== null) {
                            matches.push(match[0]);
                            if (!flags.includes('g')) break;
                        }
                        result = matches;
                        break;
                    }

                    // Other Operations
                    case "reverse":
                        result = inputValue.split('').reverse().join('');
                        break;
                    case "repeat": {
                        const count = await this.getNodeParameter("repeatCount");
                        result = inputValue.repeat(count);
                        break;
                    }
                    case "slugify":
                        result = inputValue
                            .toLowerCase()
                            .trim()
                            .replace(/[^\w\s-]/g, '')
                            .replace(/[\s_-]+/g, '-')
                            .replace(/^-+|-+$/g, '');
                        break;

                    default:
                        result = inputValue;
                }

                // Create output item
                results.push({
                    json: {
                        ...item.json,
                        [outputField]: result,
                    },
                });

            } catch (error) {
                this.logger.error(`[Text Parser] Error processing item: ${error.message}`);
                results.push({
                    json: {
                        ...item.json,
                        [outputField]: null,
                        error: error.message,
                    },
                });
            }
        }

        return [{ main: results }];
    },
};

module.exports = TextParserNode;
