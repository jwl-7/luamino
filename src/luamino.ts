#!/usr/bin/env node

// ===============
//     luamino
// ===============

import * as luaparse from 'luaparse'
import * as fs from 'fs'

interface ASTNode {
    type: string
    [key: string]: any
}

interface AST extends ASTNode {
    body: ASTNode[]
    globals: Array<{ name: string }>
}

interface ExpressionOptions {
    precedence: number
    direction: 'left' | 'right'
    parent: string | null
}

// reserved keywords
const KEYWORDS: Record<string, 1> = {
    'and': 1,
    'break': 1,
    'do': 1,
    'else': 1,
    'elseif': 1,
    'end': 1,
    'false': 1,
    'for': 1,
    'function': 1,
    'goto': 1,
    'if': 1,
    'in': 1,
    'local': 1,
    'nil': 1,
    'not': 1,
    'or': 1,
    'repeat': 1,
    'return': 1,
    'then': 1,
    'true': 1,
    'until': 1,
    'while': 1
}

// reserved globals
const PRESERVED_GLOBALS = [
    '_G',
    '_VERSION',
    'math',
    'string',
    'table',
    'print',
    'pairs',
    'ipairs',
    'type',
    'tostring',
    'tonumber',
    'require',
    'getmetatable',
    'setmetatable',
    'error',
    'assert',
    'select',
    'next',
    'rawget',
    'rawset',
    'rawequal',
    'unpack',
    'load',
    'loadfile',
    'dofile'
]

// operator precedence (higher = tighter binding)
const PRECEDENCE: Record<string, number> = {
    'or': 1,
    'and': 2,
    '<': 3,
    '>': 3,
    '<=': 3,
    '>=': 3,
    '~=': 3,
    '==': 3,
    '..': 5,
    '+': 6,
    '-': 6,
    '*': 7,
    '/': 7,
    '%': 7,
    'unarynot': 8,
    'unary#': 8,
    'unary-': 8,
    '^': 10
}

// identifier generation (base-62, first char cannot be digit)
const FIRST_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const OTHER_CHARS = FIRST_CHARS + '0123456789'
const FIRST_LIST = FIRST_CHARS.split('')
const OTHER_LIST = OTHER_CHARS.split('')

type IdGenerator = () => string

function generateShortId(): IdGenerator {
    let counter = 1
    let length = 1

    return function (): string {
        while (true) {
            let result = ''
            let temp = counter
            for (let i = 0; i < length; i++) {
                const list = i === 0 ? FIRST_LIST : OTHER_LIST
                const idx = temp % list.length
                result = list[idx === 0 ? list.length - 1 : idx - 1] + result
                temp = Math.floor((temp - 1) / list.length)
            }
            counter++
            if (counter > Math.pow(OTHER_LIST.length, length)) {
                counter = 1
                length++
            }
            if (!isKeyword(result)) return result
        }
    }
}

function isKeyword(id: string): boolean {
    return !!KEYWORDS[id]
}

// scope manager: tracks local variable renames per scope
class Scope {
    parent: Scope | null
    locals: Map<string, string>
    usedNames: Set<string>

    constructor(parent: Scope | null = null) {
        this.parent = parent
        this.locals = new Map()
        this.usedNames = new Set()
        if (parent) {
            for (let name of parent.usedNames) this.usedNames.add(name)
        }
    }

    reserveName(name: string): void {
        this.usedNames.add(name)
    }

    getLocalName(originalName: string, isLocal: boolean): string {
        if (originalName === 'self') return originalName
        if (!isLocal) return originalName

        let scope: Scope | null = this
        while (scope) {
            if (scope.locals.has(originalName)) return scope.locals.get(originalName)!
            scope = scope.parent
        }

        const gen = generateShortId()
        let newName: string
        do { newName = gen() } while (this.usedNames.has(newName))

        this.usedNames.add(newName)
        this.locals.set(originalName, newName)
        return newName
    }
}

// helper: join two code strings, adding space only when necessary
const regexAlphaUnderscore = /[a-zA-Z_]/
const regexAlphaNumUnderscore = /[a-zA-Z0-9_]/
const regexDigits = /[0-9]/

function joinStatements(a: string, b: string, separator?: string): string {
    separator = separator || ' '
    if (a === '' || a === undefined) return b
    if (b === '' || b === undefined) return a

    const lastCharA = a.slice(-1)
    const firstCharB = b.charAt(0)

    if (separator === ';' && firstCharB === '(') {
        if (regexAlphaNumUnderscore.test(lastCharA) ||
            lastCharA === ')' || lastCharA === '"' ||
            lastCharA === "'" || lastCharA === '}' || lastCharA === ']') {
            return a + separator + b
        }
    }

    if (regexAlphaUnderscore.test(lastCharA)) {
        if (regexAlphaNumUnderscore.test(firstCharB)) return a + separator + b
        return a + b
    }
    if (regexDigits.test(lastCharA)) {
        if (firstCharB === '(' || !(firstCharB === '.' || regexAlphaUnderscore.test(firstCharB))) return a + b
        return a + separator + b
    }
    if (lastCharA === '-' && firstCharB === '-') return a + separator + b
    if (lastCharA === '.' && a.slice(-2, -1) !== '.' && regexAlphaNumUnderscore.test(firstCharB)) return a + separator + b

    return a + b
}

// main minifier class
class Minifier {
    private globalScope: Scope
    private scopeStack: Scope[]

    constructor(globals: Array<{ name: string }> = []) {
        this.globalScope = new Scope()
        for (const g of globals) this.globalScope.reserveName(g.name)
        for (const name of PRESERVED_GLOBALS) this.globalScope.reserveName(name)
        this.scopeStack = []
    }

    minify(ast: AST): string {
        this.scopeStack = [this.globalScope]
        return this.walkStatements(ast.body)
    }

    private enterScope(): void { this.scopeStack.unshift(new Scope(this.scopeStack[0])) }
    private exitScope(): void { this.scopeStack.shift() }
    private currentScope(): Scope {
        if (!this.scopeStack[0]) throw new Error('no scope active')
        return this.scopeStack[0]
    }

    private formatBase(base: ASTNode): string {
        const needsParens = base.inParens &&
            base.type !== 'Identifier' && base.type !== 'IndexExpression' &&
            base.type !== 'MemberExpression' && base.type !== 'CallExpression' &&
            base.type !== 'TableCallExpression' && base.type !== 'StringCallExpression'
        let result = needsParens ? '(' : ''
        result += this.walkExpression(base)
        if (needsParens) result += ')'
        return result
    }

    private walkStatements(stmts: ASTNode[]): string {
        const parts: string[] = []
        for (const stmt of stmts) {
            const r = this.walkStatement(stmt)
            if (r) parts.push(r)
        }
        return parts.join(';')
    }

    private walkStatement(stmt: ASTNode): string {
        switch (stmt.type) {
            case 'AssignmentStatement':
                const lhs = stmt.variables.map((v: ASTNode) => this.walkExpression(v)).join(',')
                const rhs = stmt.init.map((i: ASTNode) => this.walkExpression(i)).join(',')
                return `${lhs}=${rhs}`

            case 'LocalStatement':
                const names = stmt.variables.map((v: ASTNode) => this.currentScope().getLocalName(v.name, true)).join(',')
                if (stmt.init.length) {
                    const vals = stmt.init.map((i: ASTNode) => this.walkExpression(i)).join(',')
                    return `local ${names}=${vals}`
                }
                return `local ${names}`

            case 'CallStatement':
                return this.walkExpression(stmt.expression)

            case 'IfStatement':
                let res = ''
                for (let i = 0; i < stmt.clauses.length; i++) {
                    const c = stmt.clauses[i]
                    if (i === 0) {
                        res = joinStatements('if', this.walkExpression(c.condition))
                        res = joinStatements(res, 'then')
                        res = joinStatements(res, this.walkStatements(c.body))
                    } else if (c.condition) {
                        res = joinStatements(res, 'elseif')
                        res = joinStatements(res, this.walkExpression(c.condition))
                        res = joinStatements(res, 'then')
                        res = joinStatements(res, this.walkStatements(c.body))
                    } else {
                        res = joinStatements(res, 'else')
                        res = joinStatements(res, this.walkStatements(c.body))
                    }
                }
                return joinStatements(res, 'end')

            case 'WhileStatement':
                let w = joinStatements('while', this.walkExpression(stmt.condition))
                w = joinStatements(w, 'do')
                w = joinStatements(w, this.walkStatements(stmt.body))
                return joinStatements(w, 'end')

            case 'DoStatement':
                let d = joinStatements('do', this.walkStatements(stmt.body))
                return joinStatements(d, 'end')

            case 'ReturnStatement':
                if (stmt.arguments.length) {
                    let r = 'return'
                    for (const arg of stmt.arguments) {
                        r = joinStatements(r, this.walkExpression(arg))
                    }
                    return r
                }
                return 'return'

            case 'BreakStatement':
                return 'break'

            case 'RepeatStatement':
                let rep = joinStatements('repeat', this.walkStatements(stmt.body))
                rep = joinStatements(rep, 'until')
                rep = joinStatements(rep, this.walkExpression(stmt.condition))
                return rep

            case 'FunctionDeclaration':
                this.enterScope()
                const prefix = stmt.isLocal ? 'local ' : ''
                const funcName = stmt.isLocal
                    ? this.currentScope().getLocalName(stmt.identifier.name, true)
                    : this.walkExpression(stmt.identifier)
                const params: string[] = []
                for (const p of stmt.parameters) {
                    if (p.type === 'Identifier') params.push(this.currentScope().getLocalName(p.name, true))
                    else if (p.type === 'VarargLiteral') params.push('...')
                }
                let f = `${prefix}function ${funcName}(${params.join(',')})`
                f = joinStatements(f, this.walkStatements(stmt.body))
                f = joinStatements(f, 'end')
                this.exitScope()
                return f

            case 'ForGenericStatement':
                this.enterScope()
                const vars = stmt.variables.map((v: ASTNode) => this.currentScope().getLocalName(v.name, true)).join(',')
                const iters = stmt.iterators.map((i: ASTNode) => this.walkExpression(i)).join(',')
                let fg = joinStatements('for', vars)
                fg = joinStatements(fg, 'in')
                fg = joinStatements(fg, iters)
                fg = joinStatements(fg, 'do')
                fg = joinStatements(fg, this.walkStatements(stmt.body))
                fg = joinStatements(fg, 'end')
                this.exitScope()
                return fg

            case 'ForNumericStatement':
                this.enterScope()
                const vname = this.currentScope().getLocalName(stmt.variable.name, true)
                const start = this.walkExpression(stmt.start)
                const end = this.walkExpression(stmt.end)
                const step = stmt.step ? `,${this.walkExpression(stmt.step)}` : ''
                let fn = joinStatements('for', `${vname}=${start},${end}${step}`)
                fn = joinStatements(fn, 'do')
                fn = joinStatements(fn, this.walkStatements(stmt.body))
                fn = joinStatements(fn, 'end')
                this.exitScope()
                return fn

            case 'LabelStatement':
                return `::${stmt.label.name}::`

            case 'GotoStatement':
                return `goto ${stmt.label.name}`

            default:
                return ''
        }
    }

    private walkExpression(expr: ASTNode, options: ExpressionOptions = { precedence: 0, direction: 'left', parent: null }): string {
        switch (expr.type) {
            case 'Identifier':
                for (const scope of this.scopeStack) {
                    if (scope.locals.has(expr.name)) return scope.locals.get(expr.name)!
                }
                return expr.name

            case 'StringLiteral':
            case 'NumericLiteral':
            case 'BooleanLiteral':
            case 'NilLiteral':
            case 'VarargLiteral':
                return expr.raw

            case 'LogicalExpression':
            case 'BinaryExpression':
                const op = expr.operator
                const prec = PRECEDENCE[op] || 0
                const isRightAssoc = (op === '^' || op === '..')

                let left = this.walkExpression(expr.left, { precedence: prec, direction: 'left', parent: op })
                let right = this.walkExpression(expr.right, { precedence: prec, direction: 'right', parent: op })

                let result = joinStatements(left, op)
                result = joinStatements(result, right)

                if (prec < options.precedence ||
                    (prec === options.precedence && isRightAssoc !== (options.direction === 'right') &&
                        options.parent !== '+' && !(options.parent === '*' && (op === '/' || op === '*')))) {
                    result = '(' + result + ')'
                }
                return result

            case 'UnaryExpression':
                const unaryOp = expr.operator
                const unaryPrec = PRECEDENCE['unary' + unaryOp] || 8
                const arg = this.walkExpression(expr.argument, { precedence: unaryPrec, direction: 'right', parent: unaryOp })
                let unaryResult = joinStatements(unaryOp, arg)

                if (unaryPrec < options.precedence && !(options.parent === '^' && options.direction === 'right')) {
                    unaryResult = '(' + unaryResult + ')'
                }
                return unaryResult

            case 'CallExpression':
                let callResult = this.formatBase(expr.base) + '('
                const args: string[] = []
                for (const arg of expr.arguments) {
                    args.push(this.walkExpression(arg))
                }
                callResult += args.join(',') + ')'
                if (expr.inParens) callResult = '(' + callResult + ')'
                return callResult

            case 'TableCallExpression':
                let tableCall = this.formatBase(expr.base) + this.walkExpression(expr.arguments)
                if (expr.inParens) tableCall = '(' + tableCall + ')'
                return tableCall

            case 'StringCallExpression':
                let strCall = this.formatBase(expr.base) + this.walkExpression(expr.argument)
                if (expr.inParens) strCall = '(' + strCall + ')'
                return strCall

            case 'IndexExpression':
                return this.formatBase(expr.base) + '[' + this.walkExpression(expr.index) + ']'

            case 'MemberExpression':
                return this.formatBase(expr.base) + expr.indexer + this.walkExpression(expr.identifier)

            case 'FunctionDeclaration':
                this.enterScope()
                const fparams: string[] = []
                for (const p of expr.parameters) {
                    if (p.type === 'Identifier') fparams.push(this.currentScope().getLocalName(p.name, true))
                    else if (p.type === 'VarargLiteral') fparams.push('...')
                }
                let fbody = this.walkStatements(expr.body)
                this.exitScope()
                let func = `function(${fparams.join(',')})`
                func = joinStatements(func, fbody)
                func = joinStatements(func, 'end')
                return func

            case 'TableConstructorExpression':
                const fields: string[] = []
                for (const f of expr.fields) {
                    if (f.type === 'TableKey') {
                        fields.push(`[${this.walkExpression(f.key)}]=${this.walkExpression(f.value)}`)
                    } else if (f.type === 'TableValue') {
                        fields.push(this.walkExpression(f.value))
                    } else {
                        fields.push(`${f.key.name}=${this.walkExpression(f.value)}`)
                    }
                }
                return '{' + fields.join(',') + '}'

            default:
                return ''
        }
    }
}

// entry point: parse and minify
function minify(input: string | AST): string {
    const ast = typeof input === 'string'
        ? luaparse.parse(input, { comments: false, scope: true }) as unknown as AST
        : input as AST
    if (!ast.globals) {
        throw new Error('AST missing globals. Use luaparse with scope: true')
    }
    const m = new Minifier(ast.globals)
    let result = m.minify(ast)
    result = result.replace(/[\r\n]+/g, '')
    return result
}

// cli
const args = process.argv.slice(2)

if (args.includes('-h') || args.includes('--help')) {
    console.log(`
luamino - lua minifier

usage:
  luamino <file.lua>       minify a file
  cat file.lua | luamino   read from stdin
  luamino -c "<code>"      minify code string

options:
  -h, --help    show this help
  -c            minify code from argument instead of file

examples:
  luamino script.lua
  echo 'local x = 42' | luamino
  luamino -c "local x = 42"
`)
    process.exit(0)
}

let code: string = ''

if (args.includes('-c')) {
    const idx = args.indexOf('-c')
    const codeArg = args[idx + 1]
    if (!codeArg) {
        console.error('error: -c requires a code argument')
        process.exit(1)
    }
    code = codeArg
} else if (args.length > 0 && args[0] && !args[0].startsWith('-')) {
    const filePath = args[0]
    code = fs.readFileSync(filePath, 'utf8')
} else if (!process.stdin.isTTY) {
    code = fs.readFileSync(0, 'utf8')
} else {
    console.error('error: no input provided. use -h for help.')
    process.exit(1)
}

try {
    console.log(minify(code))
} catch (err) {
    console.error('minification error:', (err as Error).message)
    process.exit(1)
}

export { minify }
