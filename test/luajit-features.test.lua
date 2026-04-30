local bor = bit.bor
local band = bit.band
function variadic(...)
    local args = { ... }
    return #args
end
local flags = bor(1, 4, 8)
print(flags)
print(variadic(10, 20, 30))
