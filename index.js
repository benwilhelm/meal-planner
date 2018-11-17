const base = require('airtable').base('appC9ddyTkD0Z22Gg')
const _ = require('lodash')

const TABLE_GROCERIES = 'Groceries'
const PORT = process.env.PORT || 3000

const server = require('express')()

server.get('*', async (req, res, next) => {
  try {
    const groceryMap = await buildGroceryMap(base)
    const mealIds = await getMealIds(base)
    const groceryList = new Set(mealIds.reduce((groceries, mealId) => {
      const mealIngredients = groceryMap[mealId] || []
      return [...groceries, ...mealIngredients]
    }, []))
    res.send(render(Array.from(groceryList)))
  } catch(e) {
    next(e)
  }
})

server.listen(PORT, (e) => {
  if (e) throw e
  console.log(`Listening on port ${PORT}`)
})


function render(list) {
  const lis = list.reduce((str, item) => str + `<li>${item}</li>`, '')
  return `
  <html>
    <h1>Groceries!</h1>
    <ul>${lis}</ul>
  </html>
  `
}


async function buildGroceryMap(base) {
  const groceryMap = {}
  await base(TABLE_GROCERIES).select().eachPage((records, next) => {
    records.forEach(({groceryId, fields}) => {
      for (col in fields) {
        if (Array.isArray(fields[col])) {
          fields[col].forEach(mealId => {
            groceryMap[mealId] = groceryMap[mealId] || []
            groceryMap[mealId].push(fields.Name)
          })
        }
      }
    })
    next()
  })
  return groceryMap
}

async function getMealIds(base) {
  const days = await base('Meal Plan').select().firstPage()
  return days.reduce((acc, curr) => {
    const fields = curr.fields
    delete fields.Name
    for (idx in fields) {
      acc = [ ...acc, ...fields[idx] ]
    }
    return acc
  }, [])
}


// takes object like
// {
//   Dinners: ["qwe", "sdlfkj", "LSkdjf"],
//   Breakfasts: ["sldkfj", 'lkjsdflksdj']
// }
function getGroceryIds(mealIds, base) {
  const meals = _.toPairs(mealIds)
                 .map(([mealName, recipes]) => ([mealName, _.uniq(recipes)]))
  const requests = meals.map(([mealName, recipeIds]) => {
    // console.log(mealName)
    return base(mealName).select({
      filterByFormula: "(record) => recipeIds.contains(record.id)"
    }).firstPage()
  })

  return Promise.all(requests).then(results => results.reduce(
    (acc, curr) => [...curr.fields.Groceries]
  ), [])
}
