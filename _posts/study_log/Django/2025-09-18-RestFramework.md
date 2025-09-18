---
title: (Django) 7. Rest Framework
post_order: 7
thumbnail: https://miro.medium.com/v2/resize:fit:1400/1*F60-kjoaKemo7O11GTdasA.jpeg
layout: post
author: jhj
categories:
  - StudyLog
  - Django
tags:
  - Django
  - Rest Framework
  - command
excerpt: GET/POST/UPDAT/DELET 설정
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# single/multi page application

![image.png](/assets/images/study_log/Django/2025-09-18-RestFramework/image.png)

- Page Reloads : url 이동 없이 주기마다 변화(설정 시)
- `Django Rest framework` : django single page application 지원 패키지
- data 전송 : `Json`

# Json

- post(server) → json(client) : Serialize
- post(server) ← json(client) : Deserialize

## Serializer

> json ↔ html
> 
- rest_framework의 `serializers.ModelSerializer` 가 `data`로 변환
    - `<ModelSerializer instance>.data` : json 변환

```python
# rest_example\utils\serializers.py

from rest_framework import serializers
from blog.models import Post, Category

class CategorySeializet(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['name', 'slug']
        
class PostSeializet(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['title', 'category', 'author', 'create_date', 'updated_date', 'content', 'uploaded_image', 'uploaded_file']
        # fields = ['__all__']
```

---

```python
# rest_example\views.py

from rest_framework.decorators import api_view 
from blog.models import Post
from .utils.serializers import PostSeializet
from rest_framework.status import HTTP_200_OK, HTTP_404_NOT_FOUND, HTTP_400_BAD_REQUEST

# Create your views here.
@api_view(['GET'])    
def helloAPI(request):
    return Response('hello world rest reponse')

@api_view(['GET', 'POST'])
def blogAPI(request):
    if request.method=='GET':
        posts = Post.objects.all()
        post_serializer = PostSeializer(posts, many=True)   # Serialize
        return Response(post_serializer.data, status=HTTP_200_OK)
    
    else :  # POST, json -> post로 변환
        de_serializer = PostSeializer(data=request.data)
        if de_serializer.is_valid():
            de_serializer.save()
            
            return Response(de_serializer.data, status=HTTP_201_CREATED)
        
        return Response(de_serializer, status=HTTP_400_BAD_REQUEST)

@api_view(['GET', 'DELETE', 'PUT', 'PATCH'])
def postAPI(request, pk):
    post = get_object_or_404(pk=pk)
    # post = Post.objects.get(pk=pk)
    
    if request.method=='GET':
        post_serializet = PostSeializer(post)   # Serialize
        return Response(post_serializet.data, status=HTTP_200_OK)
    elif request.method=='DELETE':
        post.delete()
        return Response('delete completed', status=HTTP_204_NO_CONTENT)
    else :
        seializer = PostSeializer(post, data=request.data)
        if seializer.is_valid():
            seializer.save()
            return Response(seializer.data, status=HTTP_200_OK)
            
    return Response(seializer.errors, status=HTTP_400_BAD_REQUEST)
...
```

---

![image.png](/assets/images/study_log/Django/2025-09-18-RestFramework/90133ef5-0bd8-473d-bec8-7c7038abddf0.png)

# Django Rest Framwork

> decorator의 http response GET을 받아 사용
> 

```python
from rest_framework.response import Response
from rest_framework.decorators import api_view 

# Create your views here.
@api_view(['GET'])    
def helloAPI(request):
    return Response('hello world rest reponse')
```

---

![image.png](/assets/images/study_log/Django/2025-09-18-RestFramework/image%201.png)

- `form`
    - `type='post'` : http request에 from data가 숨겨서 보내짐
    - `type='get'` : url에 붙어서 보여진 채로 보내짐
        - ex) `localhost/name='aaa'`
        - url이 더러워지는 원인
        - db 대신 사용하는 경우도…

![image.png](/assets/images/study_log/Django/2025-09-18-RestFramework/image%202.png)

![image.png](/assets/images/study_log/Django/2025-09-18-RestFramework/image%203.png)

- 동일한 url에서 method 활용
    - `/blog/create/`(post) → `/blog/`(post, create method)

| http type | CRUD | 기능 | 예시 |
| --- | --- | --- | --- |
| GET | read | • 대부분 작업
• http의 `a` 태그, url 접속 등 | 3번글 상세보기 |
| POST | create | • 포스트 작성 등
• http의 `<form type="post">` 등 | 3번글 삭제 |
| PUT | update(all) | Post를 수정했다면, 전체 항목을 다시 보내줌 | 3번글 수정 |
| PATCH | update(일부) | Post를 수정할 때 title=’수정된 제목’ 등과 같이 일부 항목만 보냄 | 댓글 수정 |
| DELETE | delete |  | 4번글 삭제 |


## Rest Framework 관리 싸이트

- [https://swagger.io/tools/swagger-ui/](https://swagger.io/tools/swagger-ui/)
- [https://www.postman.com/](https://www.postman.com/)

![image.png](/assets/images/study_log/Django/2025-09-18-RestFramework/image%204.png)