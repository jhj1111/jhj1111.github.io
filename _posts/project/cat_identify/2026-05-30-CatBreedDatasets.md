---
title: (CatHealth) 고양이 품종 데이터셋 리스트
post_order: 8
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_08.png
layout: post
author: jhj
categories:
  - Project
  - CatHealth
tags:
  - AI
  - ComputerVision
  - Python
  - TFLite
excerpt: 고양이 품종 데이터셋 리스트 종류 및 사용법
---
# kaggle API
- To use this token, set the KAGGLE_API_TOKEN environment variable:
```
export KAGGLE_API_TOKEN=$Token
```

Or save it to `~/.kaggle/access_token`, where the client will read it automatically:
```
mkdir -p ~/.kaggle && echo $Token > ~/.kaggle/access_token && chmod 600 ~/.kaggle/access_token
```

Then you can use the client as follows:
```
kaggle competitions list
```

# datasets
## petpy
- kaggle link : https://www.kaggle.com/code/alexvishnevskiy/breed-identification/input
- petpy api로 받는 듯한데 폐쇠된 듯 ~~에라이~~
```bash
kaggle kernels pull alexvishnevskiy/breed-identification
```

## kaggle dataset
- https://keyog.tistory.com/26
- kaggle link : https://www.kaggle.com/c/dogs-vs-cats-redux-kernels-edition/data
- 데이터 개수도 불분명하고 자꾸 뭘 인증하래 ~~데이터 받기 힘드네~~

## Oxford Cat Breed
- The Oxford-IIIT Pet Dataset
- 품종이 12개, 개당 200개로 품종 및 개수 부족
- 한국 품종에 최적화도 안됨
- 너무 잘 찍음
```bash
curl -L -o /content/datasets/Oxford-cat-breed-dataset.tar.gz https://thor.robots.ox.ac.uk/~vgg/data/pets/images.tar.gz
```

## roboflow
- 링크 : https://universe.roboflow.com/x-daujs/cat-breed-classification-lbhsm

```python
!pip install roboflow

from roboflow import Roboflow
rf = Roboflow(api_key="xxx")
project = rf.workspace("x-daujs").project("cat-breed-classification-lbhsm")
version = project.version(1)
dataset = version.download("folder")
```
---
```bash
curl -L "https://universe.roboflow.com/ds/jgKtvYbfhj?key=NPqCOoXfTe" > roboflow.zip; unzip roboflow.zip; rm roboflow.zip
```
