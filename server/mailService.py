import asyncio
import courier
from courier.client import AsyncCourier
import os

apiKey = os.getenv('COURIER_API_KEY')
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
