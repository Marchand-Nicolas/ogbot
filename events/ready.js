module.exports = async(client) => {
  setActivity()
  function setActivity() {
    client.user.setActivity("Starknet ID OG", { type: 'WATCHING' }) 
    setTimeout(() => {
      setActivity()
    }, 43200000);
  } 
};