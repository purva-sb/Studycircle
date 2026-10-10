const r = await fetch("http://localhost:5000/api/focus-rooms/fr1", { headers: { "Authorization": "Bearer mock" } });
console.log(await r.json());
