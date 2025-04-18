# Comprehensive Guide to Cursor AI IDE MDC Rules: Best Practices

Cursor AI is revolutionizing code development with AI-assisted features, and a key component to maximizing its potential is properly implementing MDC rules. These rules provide system-level guidance to Cursor's AI, enabling customized, consistent code generation that aligns with your project's specific requirements. This guide explores best practices for creating, structuring, and organizing MDC rules to enhance your development workflow.

## Understanding Cursor Rules

Rules in Cursor serve as persistent instructions that guide AI behavior across your coding sessions. They function by injecting context into the AI's prompt system, ensuring consistent guidance whether you're generating code, interpreting edits, or seeking assistance with workflows[1][6].

The fundamental purpose of rules is to solve a critical limitation of large language models: they don't retain memory between completions. By providing reusable context at the prompt level, rules create consistency in how the AI responds to your needs[6].

### Types of Cursor Rules

Cursor supports three distinct rule types, each serving different purposes within your development ecosystem:

1. **Project Rules**: Stored in the `.cursor/rules` directory and version-controlled, these rules are scoped to specific codebases. They're ideal for encoding project-specific knowledge, workflows, and architectural decisions[1][6].

2. **User Rules**: Global rules that apply across all projects and defined in Cursor Settings. These are perfect for setting personal preferences, response styles, or coding standards you want applied universally[1][6].

## MDC Rules Structure and Format

MDC (Markdown with Configuration) is the lightweight format used for Project Rules in Cursor. Each rule consists of two main sections: frontmatter metadata and content[1][6].

### Basic Structure

```
---
description: Brief description of the rule's purpose
globs: [optional pattern matching]
alwaysApply: [true/false]
---

Content of your rule goes here, including:
- Coding guidelines
- Architectural patterns
- Style conventions

@referenced-file.ts [optional]
```

The frontmatter metadata (between the `---` delimiters) defines how and when the rule is applied, while the content section contains the actual guidance for the AI[1][6].

### Rule Types Based on Application Method

MDC rules can be categorized into four types that determine how they're applied:

| Rule Type | Description |
|-----------|-------------|
| `Always` | Always included in the model context |
| `Auto Attached` | Included when files matching a glob pattern are referenced |
| `Agent Requested` | Available to the AI, which decides whether to include it based on relevance |
| `Manual` | Only included when explicitly mentioned using `@ruleName` |

This flexibility allows you to control precisely when and how rules are used[1][6].

## Best Practices for Creating Effective MDC Rules

### Content Guidelines

1. **Keep rules focused and concise**: Aim for under 500 lines per rule. Excessively long rules can overwhelm the AI's context window[6].

2. **Split large concepts into multiple rules**: Rather than creating one massive rule, break down complex guidelines into composable, focused rules[6][8].

3. **Be specific and actionable**: Avoid vague guidance. Write rules as clearly as you would write technical documentation[6].

4. **Include concrete examples**: Provide practical code snippets that demonstrate the patterns you want the AI to follow[3][6].

5. **Reference existing files when helpful**: Use the `@filename` syntax to include relevant files that showcase the patterns you want repeated[1][6].

6. **Keep frontmatter descriptions concise**: Limit descriptions to under 120 characters while maintaining clear intent for rule selection by the AI[4].

7. **Document your patterns**: Explain not just what to do but why, giving the AI context for your architectural decisions[8][9].

### Structural Optimization

1. **Use consistent YAML formatting** in the frontmatter section to ensure proper parsing[2].

2. **Limit examples to what's necessary** to demonstrate the pattern without overwhelming the context[4].

3. **For Agent Requested rules**, ensure you provide a clear description that helps the AI determine when to apply the rule[6].

4. **For Auto Attached rules**, carefully define glob patterns to ensure rules are triggered appropriately[6].

## Organizing and Naming MDC Rules

A systematic approach to organizing rules significantly enhances their effectiveness:

### Naming Convention

Based on community best practices, a three-digit format grouping system works effectively[2]:

- **Core Rules**: 001-099 (e.g., "001-Core-Security.mdc", "015-Core-Logging.mdc")
- **Integration Rules**: 100-199 (e.g., "100-API-Integration.mdc", "110-CLI-Handler.mdc") 
- **Pattern/Role Rules**: 200-299 (e.g., "200-File-Pattern-Rule.mdc", "210-Data-Validation.mdc")

This naming convention makes rules easily identifiable and maintains a logical organization[2].

### Creation Methods

1. **Settings UI**: The most reliable way to create rules is through Cursor Settings > Rules[2].

2. **Command Palette**: Use `Cmd + Shift + P` > "New Cursor Rule" for quick rule creation[1][6].

3. **AI-Generated Rules**: You can ask the Cursor AI to create rules based on your code patterns. Many developers use this to build their rule library quickly[8].

## Real-world Applications and Examples

### Project-Specific Coding Standards

```
---
description: TypeScript Code Standards
globs: "*.ts,*.tsx"
---

# TypeScript Coding Standards

Follow these conventions:
* Use PascalCase for class names, methods, and properties.
* Use camelCase for variables and parameters.
* Use arrow functions for callbacks.
* Prefer interfaces over types unless you need specific type features.
* Use async/await instead of promise chains.
```

This rule ensures consistent coding style across TypeScript files[3].

### Framework-Specific Patterns

```
---
description: React Component Structure
globs: "src/**/*.tsx"
---

# React Component Structure

- Use functional components with hooks instead of class components
- Define prop types using TypeScript interfaces
- Keep components small and focused on a single responsibility
- Extract reusable logic into custom hooks
- Follow the presentation/container component pattern
```

This rule guides AI in generating React components according to project standards[7].

### Error Handling Guidelines

```
---
description: Error Handling Patterns
---

# Error Handling

- Use try/catch blocks for synchronous code
- Use .catch() or try/await/catch for asynchronous code
- Create custom error classes that extend Error
- Log errors with appropriate severity levels
- Return meaningful error messages to clients without exposing sensitive information
```

This rule ensures consistent error handling throughout the codebase[9].