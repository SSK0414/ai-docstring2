import * as vscode from 'vscode';
import ollama from 'ollama';

function removeThinkTags(text: string): string {
    return text.replace(/<think>.*?<\/think>/gs, '').trim();
}

function stripMarkdown(text: string): string {
    return text.replace(/^```(?:\w+)?\s*([\s\S]*?)```$/gm, '$1').trim();
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('extension.start', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active text editor found.');
            return;
        }

        const selection = editor.selection;
        const highlightedText = editor.document.getText(selection);

        if (!highlightedText) {
            vscode.window.showInformationMessage('Please highlight the function(s) you want to generate a docstring for.');
            return;
        }

        const languageId = editor.document.languageId;
        let promptInstruction = '';

        switch (languageId) {
            case 'python':
                promptInstruction = `
                                    Below are two examples of Python functions with well-written docstrings.
                                    Generate a similar docstring for the third function. 
                                    ONLY RETURN THE DOCSTRING TEXT.
                                    No Function definition or surrounding explanations. 
                                    Do not include any surrounding explanations or the original code. 
                                    Everything should be in the comment block (triple quotes), including parameters. 
                                    
                                    Example 1:
                                    
                                    """
                                    Converts Celsius temperature to Fahrenheit.

                                    Args:
                                        celsius (float): Temperature in Celsius.

                                    Returns:
                                        float: Temperature in Fahrenheit.
                                    """
                                    def celsius_to_fahrenheit(celsius):
                                        return (celsius * 9/5) + 32

                                    Example 2:

                                    """
                                    Returns the larger of two numbers.

                                    Args:
                                        a (int): First number.
                                        b (int): Second number.

                                    Returns:
                                        int: The greater of a and b.
                                    """
                                    def max_of_two(a, b):
                                        return a if a > b else b

                                    Your Turn:
                                    ${highlightedText}\n`;
                break;
            case 'java':
                promptInstruction = `
                                    Below are two examples of Java methods with well-written JavaDoc comments. 
                                    Write a similar comment for the third method. 
                                    Only return the comment text. 
                                    Do not include any surrounding explanations or the original code. 
                                    Everything should be in the comment block (everYthing must be in /** **/ ), including the parameters. 
                                    
                                    Example 1:

                                    /**
                                     * Calculates the factorial of a number.
                                     *
                                     * @param n the number
                                     * @return the factorial of n
                                     */
                                    public int factorial(int n) {
                                        if (n <= 1) return 1;
                                        return n * factorial(n - 1);
                                    }

                                    Example 2:

                                    /**
                                     * Checks if a number is even.
                                     *
                                     * @param n the number to check
                                     * @return true if the number is even, false otherwise
                                     */
                                    public boolean isEven(int n) {
                                        return n % 2 == 0;
                                    }

                                    Your Turn:
                                    ${highlightedText}\n`;
                break;
            default:
                promptInstruction = `Provide a concise and informative docstring for the following code. Return ONLY the docstring text enclosed in the appropriate language-specific delimiters. Do not include any surrounding explanations or the original code:\n${highlightedText}`;
                break;
        }

        try {
            const response = await ollama.chat({
                model: 'deepseek-r1:latest',
                messages: [{
                    role: 'user',
                    content: promptInstruction
                }],
                stream: false
            });

            let generatedDocstring = response.message.content?.trim();

            if (generatedDocstring) {
                generatedDocstring = removeThinkTags(generatedDocstring);
                generatedDocstring = stripMarkdown(generatedDocstring);

                if (languageId === 'python') {
                    const docMatch = generatedDocstring.match(/("""[\s\S]*?""")/);
                    if (docMatch) {
                        generatedDocstring = docMatch[1];
                    }
                }
                
                if (languageId === 'java') {
                    const docMatch = generatedDocstring.match(/(\/\*\*[\s\S]*?\*\/)/);
                    if (docMatch) {
                        generatedDocstring = docMatch[1];
                    }
                }

                const insertPosition = new vscode.Position(selection.start.line, 0);
                editor.edit(editBuilder => {
                    editBuilder.insert(insertPosition, generatedDocstring + '\n');
                });
            } else {
                vscode.window.showInformationMessage('Could not generate a docstring.');
            }

        } catch (error) {
            console.error("Ollama error:", error);
            vscode.window.showErrorMessage(`Error generating docstring: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
