local foo = 42
local bar = "hello"
local function calculate(a, b)
    local result = a + b
    return result
end
local result = calculate(foo, 10)
print(result)
