import courier
from courier.client import AsyncCourier
import os
import asyncio

apiKey = os.getenv('COURIER_API_KEY')
apiKey = 'pk_prod_R7WHY1E3E8M6EZKEV3CN8WC7XM1Z'
client = AsyncCourier(authorization_token=apiKey)

async def sendMail(mailAddress: str, documentID: str):
    response = await client.send(
        message=courier.TemplateMessage(
        template='SignratureRequest',
        to=courier.UserRecipient(sendMail=mailAddress),
        data={'name': 'Cosmin', 'id':documentID, 'here': 'notHere'},
        )
    )
    return response

if __name__ == '__main__':
    print(asyncio.run(sendMail('alertsysterm@gmail.com', '123')))