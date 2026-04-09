const db = require('./src/db');
Promise.all([
  db.conversions.find({}).limit(5),
  db.offers.find({}).limit(5),
  db.conversions.find({}),
  db.offers.find({})
]).then(function(r) {
  var convS = r[0], offerS = r[1], allConvs = r[2], allOffers = r[3];
  var convIds = allConvs.map(function(c){ return c.offer_id; }).filter(Boolean);
  var extIds  = allOffers.map(function(o){ return o.external_id; }).filter(Boolean);
  var matched = convIds.filter(function(id){ return extIds.indexOf(id) !== -1; });
  console.log('CONV samples:', JSON.stringify(convS.map(function(c){ return {offer_id:c.offer_id,rev:c.revenue,date:c.created_at&&c.created_at.slice(0,10)}; })));
  console.log('OFFER samples:', JSON.stringify(offerS.map(function(o){ return {ext_id:o.external_id,name:o.name&&o.name.slice(0,30)}; })));
  console.log('Total convs:', allConvs.length, '| offers:', allOffers.length);
  console.log('Matched:', matched.length);
  console.log('Sample matched:', matched.slice(0,5));
  console.log('Unmatched conv ids (first 5):', convIds.filter(function(id){ return extIds.indexOf(id) === -1; }).slice(0,5));
  process.exit(0);
});
