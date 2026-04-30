# 🐉 luamino
TS LUA minifier

<p align="center">
    <img width="356" alt="luamino-banner" src="https://github.com/user-attachments/assets/b9a2a315-a26c-485f-9c6c-623a3906d09f" />
</p>

## 🎭 Features
- One-line output
- Removes comments and whitespace
- Renames local variables to short names (light obfuscation)
- Preserves global variables (does not rename)
- Preserves operator precedence (minimal parentheses)
- Supports Lua/LuaJIT syntax (parses in LuaJIT mode)

## 📜 Example

#### 🧩 Before
```lua
-- Calculate average with validation
local function calculateAverage(numbers)
    local sum = 0
    local count = 0

    for i, value in ipairs(numbers) do
        if type(value) == 'number' then
            sum = sum + value
            count = count + 1
        end
    end

    if count == 0 then
        return nil
    end

    return sum / count
end

local scores = { 85, 92, 78, 'invalid', 88 }
local avg = calculateAverage(scores)
print("Average: " .. avg)
```

#### 🧹 After
```lua
local function calculateAverage(a)local b=0;local c=0;for d,e in ipairs(a)do if type(e)=='number'then b=b+e;c=c+1 end end;if c==0 then return nil end;return b/c end;local a={85,92,78,'invalid',88};local b=calculateAverage(a);print("Average: "..b)
```

## 📦 Install
```bash
npm install -g https://github.com/jwl-7/luamino.git
```

## 🚀 JS
```js
const luamino = require('luamino');
const minified = luamino.minify('local x = 10');
```

## 🖥️ CLI
```bash
luamino script.lua
luamino -c "local x = 10"
echo 'local x=10' | luamino
```

## 🛠️ Built With
- [luaparse](https://oxyc.github.io/luaparse/)

## 💡 Credits
- [LuaMinify](https://github.com/stravant/LuaMinify)
- [luamin](https://github.com/mathiasbynens/luamin)
- [LuaXen](https://github.com/bytexenon/LuaXen/)
