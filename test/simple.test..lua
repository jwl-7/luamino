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
