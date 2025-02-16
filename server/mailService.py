import asyncio
import courier
from courier.client import AsyncCourier
import os

apiKey = "pk_prod_R7WHY1E3E8M6EZKEV3CN8WC7XM1Z"
notificationID = 'F7V6PWKB64452RPE0NCG6GED858T'
client = AsyncCourier(authorization_token=apiKey)

async def sendMail(mailAddress: str, url: str, name: str):
    messageTemplate = courier.TemplateMessage(
            template=notificationID,
            to=courier.UserRecipient(
                email=mailAddress,
                data={'name': name, 'url': url},
            ),
            routing=courier.Routing(method='single', channels=['email']),
        )
    
    await client.send(message=messageTemplate)


def test():
    testmail = 'alertsysterm@gmail.com'
    print(asyncio.run(sendMail(testmail, '123')))


if __name__ == '__main__':
    test()
