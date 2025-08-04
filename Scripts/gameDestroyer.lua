-- loadstring(game:HttpGet("https://liamvsc.github.io/scripts/gameDestroyer.lua"))() should work

local games = {
    [8034886758] = function() loadstring(game:HttpGet("https://raw.githubusercontent.com/liamVSC/scripts/refs/heads/main/PunchMonsters"))(); end;
    [76874769063244] = function() loadstring(game:HttpGet("https://raw.githubusercontent.com/liamVSC/scripts/refs/heads/main/MangoSim"))(); end;
}

if games[game.PlaceId] then
    games[game.PlaceId]()
end
