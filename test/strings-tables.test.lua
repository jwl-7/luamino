local t = {
    key1 = "value1",
    key2 = 42,
    [1 + 2] = "computed"
}
for k, v in pairs(t) do
    print(k, v)
end
local multi = [[multi
line
string]]
