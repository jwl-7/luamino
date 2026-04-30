#!/usr/bin/env node
interface ASTNode {
    type: string;
    [key: string]: any;
}
interface AST extends ASTNode {
    body: ASTNode[];
    globals: Array<{
        name: string;
    }>;
}
declare function minify(input: string | AST): string;
export { minify };
//# sourceMappingURL=luamino.d.ts.map