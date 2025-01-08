function catchBlock(error, errorMessage, res){
    try {
        if(error.response){
            if(error.response.data){
                console.log(errorMessage, error.response.data);
            }
            else{
                console.log(errorMessage, error.response);
            }
        }else{
            console.log(errorMessage,error);
        }
    } catch (error) {
        console.log(errorMessage,error);
    }
    if(res) return res.status(403);
}

module.exports = catchBlock;