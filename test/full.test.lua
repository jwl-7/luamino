-- Module pattern
local M = {}

---@param x number
---@param y number
---@return number
local function privateHelper(x, y)
    return x + y
end

---@param a number
---@param b number
---@return number
function M.publicMethod(a, b)
    local result = privateHelper(a, b)
    return result
end

-- Class-like table with methods
local Animal = {}
Animal.__index = Animal

---@param name string
---@param sound string
---@return Animal
function Animal.new(name, sound)
    local self = setmetatable({}, Animal)
    self.name = name
    self.sound = sound
    return self
end

---@return nil
function Animal:speak()
    print(self.name .. " says " .. self.sound)
end

-- Inheritance pattern
local Dog = setmetatable({}, { __index = Animal })
Dog.__index = Dog

---@param name string
---@return Dog
function Dog.new(name)
    local self = Animal.new(name, "Woof")
    setmetatable(self, Dog)
    return self
end

---@param item string
---@return nil
function Dog:fetch(item)
    print(self.name .. " fetches the " .. item)
end

-- Table constructors (mixed syntax, computed keys)
local t = {
    key1 = "value1",
    key2 = 42,
    [1 + 2] = "computed",
    nested = { a = 1, b = 2 }
}

-- Generic for loop with pairs
for k, v in pairs(t) do
    print(k, v)
end

-- Numeric for loop with nested scope
for i = 1, 10 do
    local squared = i * i
    if squared > 50 then
        local message = "Big number: " .. squared
        print(message)
    end
end

-- While loop with goto
local counter = 0
::loop_start::
if counter >= 5 then goto loop_end end
counter = counter + 1
print("Count: " .. counter)
goto loop_start
::loop_end::

-- Repeat until loop with continue emulation
local x = 0
::repeat_start::
x = x + 1
if x == 2 then goto repeat_start end  -- skip printing 2
print(x)
if x < 3 then goto repeat_start end

---Function returning a closure
---@param n number
---@return function
function makeMultiplier(n)
    return function(x)
        return x * n
    end
end

local double = makeMultiplier(2)
print(double(10))

-- Bit operations (LuaJIT)
local bor = bit.bor
local band = bit.band
local bxor = bit.bxor

local flags = bor(1, 4, 8)
local masked = band(flags, 7)
print(flags, masked)

-- String literals (multi-line and escaped)
local longString = [[
This is a
multi-line
string literal
]]

local escaped = "Tab\tNewline\nQuote\" Backslash\\"

-- Table operations (sort, insert, ipairs)
local tbl = { 5, 3, 8, 1, 9 }
table.sort(tbl)
table.insert(tbl, 2, 99)
for i, v in ipairs(tbl) do
    print(i, v)
end

-- Error handling with pcall
local success, err = pcall(function()
    error("something went wrong")
end)

if not success then
    print("Caught: " .. err)
end

-- Coroutine basics
local co = coroutine.create(function()
    for i = 1, 3 do
        coroutine.yield(i)
    end
end)

local results = {}
for i = 1, 3 do
    local status, value = coroutine.resume(co)
    table.insert(results, value)
end

-- Operator precedence (tests parentheses)
local a = 1 + 2 * 3        -- 7, not 9
local b = (1 + 2) * 3      -- 9
local c = 2 ^ 3 ^ 2        -- right-associative: 2^(3^2) = 512
local d = -5 ^ 2           -- unary precedence: -(5^2) = -25

print(a, b, c, d)

-- Table with computed key expressions
local computed = {
    ["key" .. 1] = "value1",
    [function() return 42 end] = "func key",
}

-- Label and goto (Lua 5.2+) - nested example
function processNumbers(nums)
    local i = 1
    ::next_num::
    if i > #nums then goto done end
    local num = nums[i]
    if num % 2 == 0 then
        i = i + 1
        goto next_num
    end
    print("odd: " .. num)
    i = i + 1
    goto next_num
    ::done::
end

processNumbers({1, 2, 3, 4, 5, 6, 7, 8, 9, 10})

---Vararg function
---@vararg any
---@return nil
function variadic(...)
    local args = { ... }
    for i = 1, select('#', ...) do
        print(args[i])
    end
end

variadic(10, 20, 30)

-- function with multiple returns
local function testMultiple()
    return 1, 2, 3
end
local p, q, r = testMultiple()
print(p, q, r)

-- Metatable with __add operator
local mt = {
    __add = function(a, b)
        return a.value + b.value
    end
}

local obj1 = setmetatable({ value = 5 }, mt)
local obj2 = setmetatable({ value = 3 }, mt)

print(obj1 + obj2)

return M
